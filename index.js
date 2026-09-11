// ===============================
// Environment
// ===============================

require("dotenv").config();


// ===============================
// Packages
// ===============================

const ExcelJS = require("exceljs");
const express = require("express");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");
const session = require("express-session");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const Student = require("./models/Student");


// ===============================
// App
// ===============================

const app = express();


// ===============================
// Session
// ===============================

app.set("trust proxy", 1);

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "student-management-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            secure:
                process.env.NODE_ENV === "production",

            httpOnly: true,

            maxAge:
                24 * 60 * 60 * 1000
        }
    })
);


// ===============================
// Middleware
// ===============================

app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// ===============================
// MongoDB
// ===============================

console.log(
    "MONGO_URI exists:",
    !!process.env.MONGO_URI
);

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected!");
    })
    .catch((error) => {
        console.log(
            "MongoDB Connection Error:",
            error
        );
    });


// ===============================
// Authentication
// ===============================

function isAuthenticated(req, res, next) {

    if (req.session.isLoggedIn) {

        next();

    } else {

        res.redirect("/login");

    }

}


// ===============================
// Login
// ===============================

app.get("/login", (req, res) => {

    res.render("login");

});


app.post("/login", (req, res) => {

    const {
        username,
        password
    } = req.body;


    if (
        username === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD
    ) {

        req.session.isLoggedIn = true;

        return res.redirect(
            "/dashboard"
        );

    }


    res.send(
        "Invalid username or password"
    );

});


// ===============================
// Logout
// ===============================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/login");

    });

});


// ===============================
// Cloudinary
// ===============================

cloudinary.config({

    cloud_name:
        process.env.CLOUDINARY_CLOUD_NAME,

    api_key:
        process.env.CLOUDINARY_API_KEY,

    api_secret:
        process.env.CLOUDINARY_API_SECRET

});


// ===============================
// Multer
// ===============================

const upload = multer({

    storage:
        multer.memoryStorage(),

    limits: {

        fileSize:
            5 * 1024 * 1024

    },

    fileFilter:
        (req, file, cb) => {

            const allowedTypes = [

                "image/jpeg",

                "image/png",

                "image/webp"

            ];


            if (
                allowedTypes.includes(
                    file.mimetype
                )
            ) {

                cb(null, true);

            } else {

                cb(
                    new Error(
                        "Only JPG, PNG and WEBP images are allowed"
                    )
                );

            }

        }

});


// ===============================
// Upload Photo
// ===============================

function uploadToCloudinary(file) {

    return new Promise(
        (resolve, reject) => {

            const stream =
                cloudinary.uploader.upload_stream(

                    {
                        folder:
                            "student-management"
                    },

                    (error, result) => {

                        if (error) {

                            reject(error);

                        } else {

                            resolve(
                                result.secure_url
                            );

                        }

                    }

                );


            stream.end(
                file.buffer
            );

        }
    );

}


// ===============================
// Calculate Progress
// ===============================

function calculateStudentProgress(
    student
) {

    let totalMarks = 0;

    let obtainedMarks = 0;


    if (
        student.exams &&
        student.exams.length > 0
    ) {

        student.exams.forEach(
            (exam) => {

                if (
                    exam.subjects &&
                    exam.subjects.length > 0
                ) {

                    exam.subjects.forEach(
                        (subject) => {

                            totalMarks +=
                                Number(
                                    subject.totalMarks ||
                                    0
                                );


                            obtainedMarks +=
                                Number(
                                    subject.obtainedMarks ||
                                    0
                                );

                        }
                    );

                }

            }
        );

    }


    if (totalMarks === 0) {

        return 0;

    }


    return Number(
        (
            (obtainedMarks /
                totalMarks) *
            100
        ).toFixed(2)
    );

}


// =================================
// Calculate Attendance Percentage
// =================================

function calculateAttendance(student) {

    let present = 0;

    let absent = 0;


    if (
        student.attendance &&
        student.attendance.length > 0
    ) {

        student.attendance.forEach((record) => {

            if (record.status === "Present") {

                present++;

            }


            if (record.status === "Absent") {

                absent++;

            }

        });

    }


    const total =
        present + absent;

    let percentage = 0;


    if (total > 0) {

        percentage =
            (present / total) * 100;

    }


    return {

        present,

        absent,

        total,

        percentage:
            Number(
                percentage.toFixed(2)
            )

    };

}


// ===============================
// Add Progress
// ===============================

function addProgressToStudents(
    students
) {

    return students.map(
        (student) => {

            const data =
                student.toObject
                    ? student.toObject()
                    : student;


            data.progress =
                calculateStudentProgress(
                    student
                );


            return data;

        }
    );

}


// ===============================
// Calculate Student Result
// ===============================

function calculateStudentResult(student) {

    let totalMarks = 0;

    let obtainedMarks = 0;


    if (
        student.exams &&
        student.exams.length > 0
    ) {

        student.exams.forEach((exam) => {

            if (
                exam.subjects &&
                exam.subjects.length > 0
            ) {

                exam.subjects.forEach((subject) => {

                    totalMarks +=
                        Number(
                            subject.totalMarks
                        ) || 0;

                    obtainedMarks +=
                        Number(
                            subject.obtainedMarks
                        ) || 0;

                });

            }

        });

    }


    let percentage = 0;


    if (totalMarks > 0) {

        percentage =
            (obtainedMarks /
                totalMarks) *
            100;

    }


    percentage =
        Number(
            percentage.toFixed(2)
        );


    let grade = "N/A";


    if (totalMarks > 0) {

        if (percentage >= 90) {

            grade = "A+";

        } else if (percentage >= 80) {

            grade = "A";

        } else if (percentage >= 70) {

            grade = "B+";

        } else if (percentage >= 60) {

            grade = "B";

        } else if (percentage >= 50) {

            grade = "C";

        } else if (percentage >= 33) {

            grade = "D";

        } else {

            grade = "F";

        }

    }


    const result =
        totalMarks > 0
            ? (
                percentage >= 33
                    ? "PASS"
                    : "FAIL"
            )
            : "N/A";


    return {

        totalMarks,

        obtainedMarks,

        percentage,

        grade,

        result

    };

}


// =========================================
// AUTOMATIC STUDENT RANKING
// =========================================

function calculateStudentRanking(students) {

    const ranking =
        students.map((student) => {

            const result =
                calculateStudentResult(
                    student
                );


            return {

                student,

                percentage:
                    result.percentage,

                grade:
                    result.grade,

                result:
                    result.result

            };

        });


    // Highest percentage first
    ranking.sort((a, b) => {

        return (
            b.percentage -
            a.percentage
        );

    });


    // Assign rank
    ranking.forEach(
        (item, index) => {

            item.rank =
                index + 1;

        }
    );


    return ranking;

}


// ==================================================
// LOGIN / DASHBOARD
// ==================================================

// ===============================
// Dashboard
// ===============================

app.get(
    "/dashboard",
    isAuthenticated,
    async (req, res) => {

        try {

            // Total Students
            const totalStudents =
                await Student.countDocuments();


            // Courses
            const courses =
                await Student.distinct("course");


            // Addresses
            const addresses =
                await Student.distinct("address");


            // Course Counts
            const courseCounts =
                await Student.aggregate([

                    {
                        $group: {
                            _id: "$course",
                            count: {
                                $sum: 1
                            }
                        }
                    },

                    {
                        $sort: {
                            count: -1
                        }
                    }

                ]);


            // Address Counts
            const addressCounts =
                await Student.aggregate([

                    {
                        $group: {
                            _id: "$address",
                            count: {
                                $sum: 1
                            }
                        }
                    },

                    {
                        $sort: {
                            count: -1
                        }
                    }

                ]);


            // Exam Counts
            const examCounts =
                await Student.aggregate([

                    {
                        $unwind: "$exams"
                    },

                    {
                        $group: {
                            _id:
                                "$exams.examName",
                            count: {
                                $sum: 1
                            }
                        }
                    },

                    {
                        $sort: {
                            count: -1
                        }
                    }

                ]);


            // All Students
            const allStudents =
                await Student.find();


            // Automatic Ranking
            const ranking =
                calculateStudentRanking(
                    allStudents
                );


            // Average Progress
            let totalProgress = 0;

            allStudents.forEach((student) => {

                totalProgress +=
                    calculateStudentProgress(
                        student
                    );

            });


            let averageProgress = 0;

            if (allStudents.length > 0) {

                averageProgress =
                    Number(
                        (
                            totalProgress /
                            allStudents.length
                        ).toFixed(2)
                    );

            }


            // Render Dashboard
            res.render(
                "dashboard",
                {

                    totalStudents,

                    totalCourses:
                        courses.length,

                    totalAddresses:
                        addresses.length,

                    courseCounts,

                    addressCounts,

                    examCounts,

                    averageProgress,

                    ranking

                }
            );


        } catch (error) {

            console.log(
                "Dashboard Error:",
                error
            );

            res.status(500).send(
                "Error loading dashboard: " +
                error.message
            );

        }

    }
);


// ==================================================
// EXPORT STUDENTS TO EXCEL
// ==================================================

app.get(
    "/students/export",
    isAuthenticated,
    async (req, res) => {

        try {

            const students =
                await Student.find().sort({
                    name: 1
                });


            const workbook =
                new ExcelJS.Workbook();


            const worksheet =
                workbook.addWorksheet(
                    "Students"
                );


            // Columns
            worksheet.columns = [

                {
                    header: "Student Name",
                    key: "name",
                    width: 25
                },

                {
                    header: "Father Name",
                    key: "fatherName",
                    width: 25
                },

                {
                    header: "Mobile",
                    key: "mobile",
                    width: 16
                },

                {
                    header: "Email",
                    key: "email",
                    width: 30
                },

                {
                    header: "Age",
                    key: "age",
                    width: 10
                },

                {
                    header: "Course",
                    key: "course",
                    width: 25
                },

                {
                    header: "Address",
                    key: "address",
                    width: 30
                },

                {
                    header: "Progress",
                    key: "progress",
                    width: 15
                },

                {
                    header: "Exams",
                    key: "exams",
                    width: 35
                }

            ];


            // Add Students
            students.forEach((student) => {

                const progress =
                    calculateStudentProgress(
                        student
                    );


                let examText = "";


                if (
                    student.exams &&
                    student.exams.length > 0
                ) {

                    student.exams.forEach(
                        (exam) => {

                            examText +=
                                exam.examName +
                                ": ";


                            if (
                                exam.subjects &&
                                exam.subjects.length > 0
                            ) {

                                exam.subjects.forEach(
                                    (subject) => {

                                        examText +=
                                            subject.subjectName +
                                            " (" +
                                            subject.obtainedMarks +
                                            "/" +
                                            subject.totalMarks +
                                            "), ";

                                    }
                                );

                            }


                            examText += "\n";

                        }
                    );

                }


                worksheet.addRow({

                    name:
                        student.name,

                    fatherName:
                        student.fatherName,

                    mobile:
                        student.mobile,

                    email:
                        student.email,

                    age:
                        student.age,

                    course:
                        student.course,

                    address:
                        student.address,

                    progress:
                        progress + "%",

                    exams:
                        examText

                });

            });


            // Header Style
            const headerRow =
                worksheet.getRow(1);


            headerRow.font = {
                bold: true
            };


            headerRow.alignment = {

                vertical: "middle",

                horizontal: "center"

            };


            headerRow.height = 25;


            // Borders
            worksheet.eachRow(
                function (row) {

                    row.eachCell(
                        function (cell) {

                            cell.border = {

                                top: {
                                    style: "thin"
                                },

                                left: {
                                    style: "thin"
                                },

                                bottom: {
                                    style: "thin"
                                },

                                right: {
                                    style: "thin"
                                }

                            };


                            cell.alignment = {

                                vertical: "top",

                                wrapText: true

                            };

                        }
                    );

                }
            );


            // Freeze Header
            worksheet.views = [

                {

                    state: "frozen",

                    ySplit: 1

                }

            ];


            // Download
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );


            res.setHeader(
                "Content-Disposition",
                'attachment; filename="students-report.xlsx"'
            );


            await workbook.xlsx.write(
                res
            );


            res.end();


        } catch (error) {

            console.log(
                "Excel export error:",
                error
            );


            res.status(500).send(
                "Error exporting students"
            );

        }

    }
);


// ===============================
// Home
// ===============================

app.get("/", (req, res) => {

    res.redirect("/students");

});


// ==================================================
// STUDENTS LIST
// ==================================================

app.get(
    "/students",
    isAuthenticated,
    async (req, res) => {

        try {

            const search =
                req.query.search || "";


            const course =
                req.query.course || "";


            const address =
                req.query.address || "";


            const filter = {};


            // Search
            if (search) {

                filter.$or = [

                    {
                        name: {
                            $regex: search,
                            $options: "i"
                        }
                    },

                    {
                        fatherName: {
                            $regex: search,
                            $options: "i"
                        }
                    },

                    {
                        mobile: {
                            $regex: search,
                            $options: "i"
                        }
                    },

                    {
                        email: {
                            $regex: search,
                            $options: "i"
                        }
                    },

                    {
                        course: {
                            $regex: search,
                            $options: "i"
                        }
                    },

                    {
                        address: {
                            $regex: search,
                            $options: "i"
                        }
                    }

                ];

            }


            // Course Filter
            if (course) {

                filter.course =
                    course;

            }


            // Address Filter
            if (address) {

                filter.address =
                    address;

            }


            const students =
                await Student.find(
                    filter
                );


            const studentsWithProgress =
                addProgressToStudents(
                    students
                );


            const courses =
                await Student.distinct(
                    "course"
                );


            const addresses =
                await Student.distinct(
                    "address"
                );


            res.render(
                "students",
                {

                    students:
                        studentsWithProgress,

                    search,

                    courses,

                    addresses,

                    selectedCourse:
                        course,

                    selectedAddress:
                        address

                }
            );


        } catch (error) {

            console.log(
                "Students Error:",
                error
            );


            res.status(500).send(
                "Error loading students: " +
                error.message
            );

        }

    }
);


// ==================================================
// ADD STUDENT
// ==================================================


// ===============================
// Add Page
// ===============================

app.get(
    "/students/add",
    isAuthenticated,
    (req, res) => {

        res.render(
            "add-student"
        );

    }
);


// ===============================
// Add Student
// ===============================

app.post(
    "/students",
    isAuthenticated,
    upload.single("photo"),
    async (req, res) => {

        try {

            const {

                name,

                fatherName,

                mobile,

                email,

                age,

                course,

                address,

                exams

            } = req.body;


            // Basic Validation
            if (
                !name ||
                !fatherName ||
                !mobile ||
                !email ||
                !age ||
                !course ||
                !address
            ) {

                return res.send(
                    "Please fill all required fields"
                );

            }


            // Age Validation
            if (
                Number(age) < 1 ||
                Number(age) > 100
            ) {

                return res.send(
                    "Please enter a valid age"
                );

            }


            // Mobile Validation
            if (
                !/^[0-9]{10}$/.test(
                    mobile
                )
            ) {

                return res.send(
                    "Please enter a valid 10 digit mobile number"
                );

            }


            // ===============================
            // Exams
            // ===============================

            let formattedExams = [];


            if (exams) {

                const examArray =
                    Array.isArray(exams)
                        ? exams
                        : [exams];


                examArray.forEach(
                    (exam) => {

                        if (
                            !exam.examName
                        ) {

                            return;

                        }


                        let subjects = [];


                        if (
                            exam.subjects
                        ) {

                            const subjectArray =
                                Array.isArray(
                                    exam.subjects
                                )
                                    ? exam.subjects
                                    : [
                                        exam.subjects
                                    ];


                            subjectArray.forEach(
                                (subject) => {

                                    if (
                                        !subject.subjectName
                                    ) {

                                        return;

                                    }


                                    const totalMarks =
                                        Number(
                                            subject.totalMarks
                                        );


                                    const obtainedMarks =
                                        Number(
                                            subject.obtainedMarks
                                        );


                                    if (
                                        totalMarks <= 0
                                    ) {

                                        throw new Error(
                                            "Total marks must be greater than 0"
                                        );

                                    }


                                    if (
                                        obtainedMarks < 0 ||
                                        obtainedMarks >
                                        totalMarks
                                    ) {

                                        throw new Error(
                                            "Obtained marks must be between 0 and total marks"
                                        );

                                    }


                                    subjects.push({

                                        subjectName:
                                            subject.subjectName,

                                        totalMarks,

                                        obtainedMarks

                                    });

                                }
                            );

                        }


                        if (
                            subjects.length > 0
                        ) {

                            formattedExams.push({

                                examName:
                                    exam.examName,

                                subjects

                            });

                        }

                    }
                );

            }


            // ===============================
            // Photo Upload
            // ===============================

            let photoUrl = "";


            if (req.file) {

                photoUrl =
                    await uploadToCloudinary(
                        req.file
                    );

            }


            // ===============================
            // Create Student
            // ===============================

            await Student.create({

                name,

                fatherName,

                mobile,

                email,

                photo:
                    photoUrl,

                age:
                    Number(age),

                course,

                address,

                exams:
                    formattedExams

            });


            res.redirect(
                "/students"
            );


        } catch (error) {

            console.log(
                "Error adding student:",
                error
            );


            res.status(500).send(
                "Error adding student: " +
                error.message
            );

        }

    }
);


// ==================================================
// STUDENT DETAILS PAGE
// ==================================================

app.get(
    "/students/view/:id",
    isAuthenticated,
    async (req, res) => {

        try {

            const student =
                await Student.findById(
                    req.params.id
                );


            if (!student) {

                return res
                    .status(404)
                    .send(
                        "Student not found"
                    );

            }


            const progress =
                calculateStudentProgress(
                    student
                );


            const attendance =
                calculateAttendance(
                    student
                );


            const result =
                calculateStudentResult(
                    student
                );


            res.render(
                "student-details",
                {

                    student,

                    progress,

                    attendance,

                    result

                }
            );


        } catch (error) {

            console.log(error);


            res.status(500).send(
                "Server Error"
            );

        }

    }
);

// =========================================
// PROFESSIONAL STUDENT PDF
// =========================================

app.get(
    "/students/pdf/:id",
    isAuthenticated,
    async (req, res) => {

        try {

            const student =
                await Student.findById(
                    req.params.id
                );


            if (!student) {

                return res
                    .status(404)
                    .send("Student not found");

            }


            const progress =
                calculateStudentProgress(
                    student
                );


            const attendance =
                calculateAttendance(
                    student
                );


            const result =
                calculateStudentResult(
                    student
                );


            // =================================
            // PDF DOCUMENT
            // =================================

            const PDFDocument =
                require("pdfkit");


            const doc =
                new PDFDocument({

                    size: "A4",

                    margin: 40,

                    bufferPages: true

                });


            res.setHeader(
                "Content-Type",
                "application/pdf"
            );


            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${student.name}-student-report.pdf"`
            );


            doc.pipe(res);


            // =================================
            // HEADER
            // =================================

            doc
                .font("Helvetica-Bold")
                .fontSize(22)
                .text(
                    "STUDENT MANAGEMENT SYSTEM",
                    {
                        align: "center"
                    }
                );


            doc.moveDown(0.3);


            doc
                .font("Helvetica")
                .fontSize(11)
                .text(
                    "Student Academic Report",
                    {
                        align: "center"
                    }
                );


            doc.moveDown(1);


            // Line
            doc
                .moveTo(40, doc.y)
                .lineTo(555, doc.y)
                .stroke();


            doc.moveDown(1);


            // =================================
            // STUDENT PHOTO
            // =================================

            const startY =
                doc.y;


            if (student.photo) {

                try {

                    let photoUrl =
                        student.photo;


                    if (
                        photoUrl.includes(
                            "cloudinary.com"
                        ) &&
                        photoUrl.includes(
                            "/upload/"
                        )
                    ) {

                        photoUrl =
                            photoUrl.replace(
                                "/upload/",
                                "/upload/f_jpg/"
                            );

                    }


                    const response =
                        await fetch(
                            photoUrl
                        );


                    if (response.ok) {

                        const imageBuffer =
                            Buffer.from(
                                await response.arrayBuffer()
                            );


                        doc.image(
                            imageBuffer,
                            430,
                            startY,
                            {

                                fit: [
                                    110,
                                    110
                                ],

                                align: "center",

                                valign: "center"

                            }
                        );

                    }

                } catch (photoError) {

                    console.log(
                        "PDF Photo Error:",
                        photoError.message
                    );

                }

            }


            // =================================
            // STUDENT DETAILS
            // =================================

            doc
                .font("Helvetica-Bold")
                .fontSize(15)
                .text(
                    "Student Details",
                    40,
                    startY
                );


            doc.moveDown(0.6);


            function detail(
                label,
                value
            ) {

                doc
                    .font("Helvetica-Bold")
                    .fontSize(10)
                    .text(
                        label + ": ",
                        {
                            continued: true
                        }
                    )
                    .font("Helvetica")
                    .text(
                        value || "-"
                    );

            }


            detail(
                "Name",
                student.name
            );


            detail(
                "Father Name",
                student.fatherName
            );


            detail(
                "Mobile",
                student.mobile
            );


            detail(
                "Email",
                student.email
            );


            detail(
                "Age",
                String(
                    student.age || "-"
                )
            );


            detail(
                "Course",
                student.course
            );


            detail(
                "Address",
                student.address
            );


            doc.y =
                Math.max(
                    doc.y,
                    startY + 125
                );


            doc.moveDown(0.5);


            // =================================
            // ACADEMIC SUMMARY
            // =================================

            doc
                .font("Helvetica-Bold")
                .fontSize(15)
                .text(
                    "Academic Summary"
                );


            doc.moveDown(0.5);


            const summaryY =
                doc.y;


            doc
                .rect(
                    40,
                    summaryY,
                    515,
                    65
                )
                .stroke();


            // Total Exams
            doc
                .font("Helvetica-Bold")
                .fontSize(11)
                .text(
                    "Total Exams",
                    55,
                    summaryY + 12
                );


            doc
                .font("Helvetica")
                .fontSize(13)
                .text(
                    String(
                        student.exams
                            ? student.exams.length
                            : 0
                    ),
                    55,
                    summaryY + 32
                );


            // Total Marks
            doc
                .font("Helvetica-Bold")
                .fontSize(11)
                .text(
                    "Total Marks",
                    190,
                    summaryY + 12
                );


            doc
                .font("Helvetica")
                .fontSize(13)
                .text(
                    String(
                        result.totalMarks
                    ),
                    190,
                    summaryY + 32
                );


            // Obtained Marks
            doc
                .font("Helvetica-Bold")
                .fontSize(11)
                .text(
                    "Obtained Marks",
                    320,
                    summaryY + 12
                );


            doc
                .font("Helvetica")
                .fontSize(13)
                .text(
                    String(
                        result.obtainedMarks
                    ),
                    320,
                    summaryY + 32
                );


            // Percentage
            doc
                .font("Helvetica-Bold")
                .fontSize(11)
                .text(
                    "Percentage",
                    450,
                    summaryY + 12
                );


            doc
                .font("Helvetica")
                .fontSize(13)
                .text(
                    result.percentage + "%",
                    450,
                    summaryY + 32
                );


            doc.y =
                summaryY + 85;


            // =================================
            // RESULT
            // =================================

            doc
                .font("Helvetica-Bold")
                .fontSize(15)
                .text(
                    "Result"
                );


            doc.moveDown(0.5);


            doc
                .font("Helvetica")
                .fontSize(12)
                .text(
                    "Overall Result: " +
                    result.result
                );


            doc
                .font("Helvetica")
                .fontSize(12)
                .text(
                    "Grade: " +
                    result.grade
                );


            doc.moveDown(1);


            // =================================
            // ATTENDANCE SUMMARY
            // =================================

            doc
                .font("Helvetica-Bold")
                .fontSize(15)
                .text(
                    "Attendance Summary"
                );


            doc.moveDown(0.5);


            const attendanceY =
                doc.y;


            doc
                .rect(
                    40,
                    attendanceY,
                    515,
                    65
                )
                .stroke();


            // Present
            doc
                .font("Helvetica-Bold")
                .fontSize(11)
                .text(
                    "Present",
                    55,
                    attendanceY + 12
                );


            doc
                .font("Helvetica")
                .fontSize(13)
                .text(
                    String(
                        attendance.present
                    ),
                    55,
                    attendanceY + 32
                );


            // Absent
            doc
                .font("Helvetica-Bold")
                .fontSize(11)
                .text(
                    "Absent",
                    180,
                    attendanceY + 12
                );


            doc
                .font("Helvetica")
                .fontSize(13)
                .text(
                    String(
                        attendance.absent
                    ),
                    180,
                    attendanceY + 32
                );


            // Total Days
            doc
                .font("Helvetica-Bold")
                .fontSize(11)
                .text(
                    "Total Days",
                    305,
                    attendanceY + 12
                );


            doc
                .font("Helvetica")
                .fontSize(13)
                .text(
                    String(
                        attendance.total
                    ),
                    305,
                    attendanceY + 32
                );


            // Attendance %
            doc
                .font("Helvetica-Bold")
                .fontSize(11)
                .text(
                    "Attendance %",
                    430,
                    attendanceY + 12
                );


            doc
                .font("Helvetica")
                .fontSize(13)
                .text(
                    attendance.percentage +
                    "%",
                    430,
                    attendanceY + 32
                );


            doc.y =
                attendanceY + 85;


            // =================================
            // EXAM DETAILS
            // =================================

            if (
                student.exams &&
                student.exams.length > 0
            ) {

                doc
                    .font("Helvetica-Bold")
                    .fontSize(15)
                    .text(
                        "Exam Details"
                    );


                doc.moveDown(0.5);


                student.exams.forEach(
                    (exam) => {

                        // Page break if needed
                        if (
                            doc.y > 700
                        ) {

                            doc.addPage();

                        }


                        doc
                            .font(
                                "Helvetica-Bold"
                            )
                            .fontSize(12)
                            .text(
                                exam.examName
                            );


                        doc.moveDown(0.3);


                        if (
                            exam.subjects &&
                            exam.subjects.length > 0
                        ) {

                            exam.subjects.forEach(
                                (subject) => {

                                    const subjectTotal =
                                        Number(
                                            subject.totalMarks ||
                                            0
                                        );


                                    const subjectObtained =
                                        Number(
                                            subject.obtainedMarks ||
                                            0
                                        );


                                    const subjectPercentage =
                                        subjectTotal > 0
                                            ? (
                                                subjectObtained /
                                                subjectTotal
                                            ) *
                                            100
                                            : 0;


                                    doc
                                        .font(
                                            "Helvetica"
                                        )
                                        .fontSize(10)
                                        .text(
                                            subject.subjectName +
                                            "   " +
                                            subjectObtained +
                                            "/" +
                                            subjectTotal +
                                            "   " +
                                            subjectPercentage.toFixed(
                                                2
                                            ) +
                                            "%"
                                        );

                                }
                            );

                        }


                        doc.moveDown(0.6);

                    }
                );

            } else {

                doc
                    .font("Helvetica")
                    .fontSize(11)
                    .text(
                        "No exam records available."
                    );

            }


            // =================================
            // FOOTER
            // =================================

            doc.moveDown(1);


            doc
                .font("Helvetica")
                .fontSize(9)
                .text(
                    "Generated by Student Management System",
                    {
                        align: "center"
                    }
                );


            doc.end();


        } catch (error) {

            console.log(
                "PDF Error:",
                error
            );


            if (!res.headersSent) {

                res
                    .status(500)
                    .send(
                        "Error generating PDF: " +
                        error.message
                    );

            }

        }

    }
);


// ==================================================
// EDIT STUDENT
// ==================================================


// ===============================
// Edit Page
// ===============================

app.get(
    "/students/edit/:id",
    isAuthenticated,
    async (req, res) => {

        try {

            const student =
                await Student.findById(
                    req.params.id
                );


            if (!student) {

                return res
                    .status(404)
                    .send(
                        "Student not found"
                    );

            }


            res.render(
                "edit-student",
                {
                    student
                }
            );


        } catch (error) {

            console.log(
                "Edit Page Error:",
                error
            );


            res
                .status(500)
                .send(
                    "Error loading edit page"
                );

        }

    }
);


// ===============================
// Update Student
// ===============================

app.post(
    "/students/update/:id",
    isAuthenticated,
    upload.single("photo"),
    async (req, res) => {

        try {

            const {

                name,

                fatherName,

                mobile,

                email,

                age,

                course,

                address,

                exams

            } = req.body;


            // Basic validation
            if (
                !name ||
                !fatherName ||
                !mobile ||
                !email ||
                !age ||
                !course ||
                !address
            ) {

                return res.send(
                    "Please fill all required fields"
                );

            }


            // Age validation
            if (
                Number(age) < 1 ||
                Number(age) > 100
            ) {

                return res.send(
                    "Please enter a valid age"
                );

            }


            // Mobile validation
            if (
                !/^[0-9]{10}$/.test(
                    mobile
                )
            ) {

                return res.send(
                    "Please enter a valid 10 digit mobile number"
                );

            }


            // =================================
            // Format Exams
            // =================================

            let formattedExams = [];


            if (exams) {

                const examArray =
                    Array.isArray(exams)
                        ? exams
                        : [exams];


                examArray.forEach(
                    (exam) => {

                        if (
                            !exam.examName
                        ) {

                            return;

                        }


                        let subjects = [];


                        if (
                            exam.subjects
                        ) {

                            const subjectArray =
                                Array.isArray(
                                    exam.subjects
                                )
                                    ? exam.subjects
                                    : [
                                        exam.subjects
                                    ];


                            subjectArray.forEach(
                                (subject) => {

                                    if (
                                        !subject.subjectName
                                    ) {

                                        return;

                                    }


                                    const totalMarks =
                                        Number(
                                            subject.totalMarks
                                        );


                                    const obtainedMarks =
                                        Number(
                                            subject.obtainedMarks
                                        );


                                    if (
                                        totalMarks <= 0
                                    ) {

                                        throw new Error(
                                            "Total marks must be greater than 0"
                                        );

                                    }


                                    if (
                                        obtainedMarks < 0 ||
                                        obtainedMarks >
                                        totalMarks
                                    ) {

                                        throw new Error(
                                            "Obtained marks must be between 0 and total marks"
                                        );

                                    }


                                    subjects.push({

                                        subjectName:
                                            subject.subjectName,

                                        totalMarks,

                                        obtainedMarks

                                    });

                                }
                            );

                        }


                        if (
                            subjects.length > 0
                        ) {

                            formattedExams.push({

                                examName:
                                    exam.examName,

                                subjects

                            });

                        }

                    }
                );

            }


            // =================================
            // Existing Student
            // =================================

            const student =
                await Student.findById(
                    req.params.id
                );


            if (!student) {

                return res
                    .status(404)
                    .send(
                        "Student not found"
                    );

            }


            // =================================
            // Photo
            // =================================

            let photoUrl =
                student.photo || "";


            if (req.file) {

                photoUrl =
                    await uploadToCloudinary(
                        req.file
                    );

            }


            // =================================
            // Update
            // =================================

            student.name =
                name;

            student.fatherName =
                fatherName;

            student.mobile =
                mobile;

            student.email =
                email;

            student.age =
                Number(age);

            student.course =
                course;

            student.address =
                address;

            student.photo =
                photoUrl;

            student.exams =
                formattedExams;


            await student.save();


            res.redirect(
                "/students/view/" +
                student._id
            );


        } catch (error) {

            console.log(
                "Update Student Error:",
                error
            );


            res
                .status(500)
                .send(
                    "Error updating student: " +
                    error.message
                );

        }

    }
);

// ==================================================
// DELETE
// ==================================================


// ===============================
// Delete Student
// ===============================

app.post(
    "/students/delete/:id",
    isAuthenticated,
    async (req, res) => {

        try {

            await Student.findByIdAndDelete(
                req.params.id
            );


            res.redirect(
                "/students"
            );


        } catch (error) {

            console.log(
                "Delete Error:",
                error
            );


            res.status(500).send(
                "Error deleting student"
            );

        }

    }
);


// ==================================================
// API
// ==================================================


// ===============================
// Get Student API
// ===============================

app.get(
    "/students/:id",
    async (req, res) => {

        try {

            const student =
                await Student.findById(
                    req.params.id
                );


            if (!student) {

                return res
                    .status(404)
                    .json({

                        message:
                            "Student not found"

                    });

            }


            const data =
                student.toObject();


            data.progress =
                calculateStudentProgress(
                    student
                );


            res.json(
                data
            );


        } catch (error) {

            res.status(500).json({

                message:
                    "Invalid student ID",

                error:
                    error.message

            });

        }

    }
);


// ===============================
// Update API
// ===============================

app.put(
    "/students/:id",
    isAuthenticated,
    async (req, res) => {

        try {

            const student =
                await Student.findByIdAndUpdate(

                    req.params.id,

                    req.body,

                    {

                        new: true,

                        runValidators:
                            true

                    }

                );


            if (!student) {

                return res
                    .status(404)
                    .json({

                        message:
                            "Student not found"

                    });

            }


            const data =
                student.toObject();


            data.progress =
                calculateStudentProgress(
                    student
                );


            res.json({

                message:
                    "Student updated successfully",

                student:
                    data

            });


        } catch (error) {

            res.status(500).json({

                message:
                    "Error",

                error:
                    error.message

            });

        }

    }
);


// ===============================
// Delete API
// ===============================

app.delete(
    "/students/:id",
    isAuthenticated,
    async (req, res) => {

        try {

            const student =
                await Student.findByIdAndDelete(
                    req.params.id
                );


            if (!student) {

                return res
                    .status(404)
                    .json({

                        message:
                            "Student not found"

                    });

            }


            res.json({

                message:
                    "Student deleted successfully",

                student

            });


        } catch (error) {

            res.status(500).json({

                message:
                    "Error",

                error:
                    error.message

            });

        }

    }
);


// ==================================================
// ATTENDANCE SYSTEM
// ==================================================


// =========================================
// ATTENDANCE PAGE
// =========================================

app.get(
    "/attendance",
    isAuthenticated,
    async (req, res) => {

        try {

            // Today's date
            const today =
                new Date()
                    .toISOString()
                    .split("T")[0];


            const selectedDate =
                req.query.date || today;


            // Get all students
            const students =
                await Student.find()
                    .sort({
                        name: 1
                    });


            // Check attendance for selected date
            students.forEach(
                (student) => {

                    student.todayStatus =
                        "";


                    if (
                        student.attendance &&
                        student.attendance.length > 0
                    ) {

                        const record =
                            student.attendance.find(
                                (item) => {

                                    const itemDate =
                                        new Date(
                                            item.date
                                        )
                                            .toISOString()
                                            .split("T")[0];


                                    return (
                                        itemDate ===
                                        selectedDate
                                    );

                                }
                            );


                        if (record) {

                            student.todayStatus =
                                record.status;

                        }

                    }

                }
            );


            res.render(
                "attendance",
                {

                    students,

                    selectedDate

                }
            );


        } catch (error) {

            console.log(
                "Attendance Page Error:",
                error
            );


            res.status(500).send(
                "Error loading attendance: " +
                error.message
            );

        }

    }
);


// =========================================
// SAVE ATTENDANCE
// =========================================

app.post(
    "/attendance",
    isAuthenticated,
    async (req, res) => {

        try {

            const date =
                req.body.date;


            const attendance =
                req.body.attendance;


            // Check date
            if (!date) {

                return res.status(400).send(
                    "Please select a date"
                );

            }


            // Check attendance
            if (!attendance) {

                return res.status(400).send(
                    "Please mark attendance"
                );

            }


            // Store date as UTC midnight
            const selectedDate =
                new Date(
                    date +
                    "T00:00:00.000Z"
                );


            // Next day
            const nextDate =
                new Date(
                    selectedDate.getTime() +
                    24 * 60 * 60 * 1000
                );


            // =================================
            // Save every student's attendance
            // =================================

            for (
                const studentId in attendance
            ) {

                const status =
                    attendance[studentId];


                // Only Present / Absent
                if (
                    status !== "Present" &&
                    status !== "Absent"
                ) {

                    continue;

                }


                // Find student
                const student =
                    await Student.findById(
                        studentId
                    );


                if (!student) {

                    continue;

                }


                // Check existing attendance
                const existingRecord =
                    await Student.findOne({

                        _id: studentId,

                        "attendance.date": {

                            $gte:
                                selectedDate,

                            $lt:
                                nextDate

                        }

                    });


                // =================================
                // UPDATE EXISTING ATTENDANCE
                // =================================

                if (existingRecord) {

                    await Student.updateOne(

                        {

                            _id:
                                studentId,

                            "attendance.date": {

                                $gte:
                                    selectedDate,

                                $lt:
                                    nextDate

                            }

                        },

                        {

                            $set: {

                                "attendance.$.status":
                                    status

                            }

                        }

                    );

                }


                // =================================
                // ADD NEW ATTENDANCE
                // =================================

                else {

                    await Student.updateOne(

                        {

                            _id:
                                studentId

                        },

                        {

                            $push: {

                                attendance: {

                                    date:
                                        selectedDate,

                                    status:
                                        status

                                }

                            }

                        }

                    );

                }

            }


            // Redirect
            res.redirect(
                "/attendance?date=" +
                encodeURIComponent(
                    date
                )
            );


        } catch (error) {

            console.log(
                "Save Attendance Error:",
                error
            );


            res.status(500).send(
                "Error saving attendance: " +
                error.message
            );

        }

    }
);


// =========================================
// ABSENT STUDENTS PANEL
// =========================================

app.get(
    "/attendance/absent",
    isAuthenticated,
    async (req, res) => {

        try {

            const today =
                new Date()
                    .toISOString()
                    .split("T")[0];


            const selectedDate =
                req.query.date || today;


            // Date range
            const startDate =
                new Date(
                    selectedDate +
                    "T00:00:00.000Z"
                );


            const endDate =
                new Date(
                    selectedDate +
                    "T23:59:59.999Z"
                );


            // Absent students
            const students =
                await Student.find({

                    attendance: {

                        $elemMatch: {

                            date: {

                                $gte:
                                    startDate,

                                $lte:
                                    endDate

                            },

                            status:
                                "Absent"

                        }

                    }

                }).sort({

                    name: 1

                });


            // Total students
            const totalStudents =
                await Student.countDocuments();


            // Present students
            const presentStudents =
                await Student.countDocuments({

                    attendance: {

                        $elemMatch: {

                            date: {

                                $gte:
                                    startDate,

                                $lte:
                                    endDate

                            },

                            status:
                                "Present"

                        }

                    }

                });


            const absentStudents =
                students.length;


            // Attendance percentage
            let attendancePercentage =
                0;


            if (
                totalStudents > 0
            ) {

                attendancePercentage =
                    (
                        presentStudents /
                        totalStudents
                    ) *
                    100;

            }


            res.render(
                "absent-students",
                {

                    students,

                    selectedDate,

                    totalStudents,

                    presentStudents,

                    absentStudents,

                    attendancePercentage:
                        attendancePercentage.toFixed(
                            2
                        )

                }
            );


        } catch (error) {

            console.log(
                "Absent Panel Error:",
                error
            );


            res.status(500).send(
                "Error loading absent students: " +
                error.message
            );

        }

    }
);


// ===============================
// SERVER
// ===============================

const PORT =
    process.env.PORT || 3000;


app.listen(
    PORT,
    () => {

        console.log(
            `Server started on port ${PORT}`
        );

    }
);