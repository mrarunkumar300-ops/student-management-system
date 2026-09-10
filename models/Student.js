require("dotenv").config();

console.log("STEP 1: dotenv loaded");

const bcrypt = require("bcryptjs");
const express = require("express");

const mongoose = require("mongoose");

// Student Model
const session = require("express-session");

const Student = require("./models/Student");

console.log("STEP 2: packages loaded");

const app = express();

console.log("STEP 3: app created");


// ===============================
// Session
// ===============================

app.use(session({
    secret: "student-management-secret",
    resave: false,
    saveUninitialized: false
}));


// ===============================
// Middleware
// ===============================

app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));


// ===============================
// MongoDB Connection
// ===============================

console.log(
    "STEP 4: MONGO_URI exists:",
    !!process.env.MONGO_URI
);

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected!");
    })
    .catch((err) => {
        console.log("MongoDB Connection Error:", err);
    });


// ===============================
// Login Protection
// ===============================

function isAuthenticated(req, res, next) {

    if (req.session.isLoggedIn) {

        next();

    } else {

        res.redirect("/login");

    }

}


// ===============================
// Admin Login
// ===============================

app.get("/login", (req, res) => {

    res.render("login");

});


app.post("/login", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;


        if (
            !process.env.ADMIN_USERNAME ||
            !process.env.ADMIN_PASSWORD_HASH
        ) {

            console.log(
                "Admin login environment variables are missing"
            );

            return res
                .status(500)
                .send("Admin login is not configured");

        }


        const passwordMatch = await bcrypt.compare(
            password,
            process.env.ADMIN_PASSWORD_HASH
        );


        if (
            username === process.env.ADMIN_USERNAME &&
            passwordMatch
        ) {

            req.session.isLoggedIn = true;

            res.redirect("/dashboard");

        } else {

            res.send("Invalid username or password");

        }

    } catch (error) {

        console.log("Login Error:", error);

        res.status(500).send(
            "Internal Server Error"
        );

    }

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
// Helper Function
// Calculate Student Progress
// ===============================

function calculateStudentProgress(student) {

    let totalMarks = 0;

    let obtainedMarks = 0;


    if (
        student.exams &&
        student.exams.length > 0
    ) {

        student.exams.forEach(exam => {

            if (
                exam.subjects &&
                exam.subjects.length > 0
            ) {

                exam.subjects.forEach(subject => {

                    totalMarks += Number(
                        subject.totalMarks || 0
                    );

                    obtainedMarks += Number(
                        subject.obtainedMarks || 0
                    );

                });

            }

        });

    }


    if (totalMarks === 0) {

        return 0;

    }


    return Number(
        ((obtainedMarks / totalMarks) * 100).toFixed(2)
    );

}


// ===============================
// Prepare Students with Progress
// ===============================

function addProgressToStudents(students) {

    return students.map(student => {

        const studentObject =
            student.toObject
                ? student.toObject()
                : student;

        studentObject.progress =
            calculateStudentProgress(student);

        return studentObject;

    });

}


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


            // Course-wise Count
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


            // Address-wise Count
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


            // Exam-wise Count
            const examCounts =
                await Student.aggregate([

                    {
                        $unwind: "$exams"
                    },

                    {
                        $group: {

                            _id: "$exams.examName",

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


            // Average Progress
            const allStudents =
                await Student.find();


            let totalProgress = 0;


            allStudents.forEach(student => {

                totalProgress +=
                    calculateStudentProgress(student);

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


            res.render("dashboard", {

                totalStudents,

                totalCourses:
                    courses.length,

                totalAddresses:
                    addresses.length,

                courseCounts,

                addressCounts,

                examCounts,

                averageProgress

            });

        } catch (error) {

            console.log(error);

            res.send(
                "Error loading dashboard"
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


// ===============================
// Students List
// ===============================

app.get("/students", async (req, res) => {

    try {

        const search =
            req.query.search || "";


        const course =
            req.query.course || "";


        const address =
            req.query.address || "";


        const filter = {};


        // ===============================
        // Search
        // ===============================

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


        // ===============================
        // Course Filter
        // ===============================

        if (course) {

            filter.course = course;

        }


        // ===============================
        // Address Filter
        // ===============================

        if (address) {

            filter.address = address;

        }


        // ===============================
        // Get Students
        // ===============================

        const students =
            await Student.find(filter);


        const studentsWithProgress =
            addProgressToStudents(students);


        // Courses
        const courses =
            await Student.distinct("course");


        // Addresses
        const addresses =
            await Student.distinct("address");


        res.render("students", {

            students:
                studentsWithProgress,

            search,

            courses,

            addresses,

            selectedCourse:
                course,

            selectedAddress:
                address

        });

    } catch (error) {

        console.log(error);

        res.send(
            "Error loading students"
        );

    }

});


// ===============================
// Add Student Page
// ===============================

app.get(
    "/students/add",
    isAuthenticated,
    (req, res) => {

        res.render("add-student");

    }
);


// ===============================
// Add Student
// ===============================

// ===============================
// Add Student
// ===============================

app.post(
    "/students",
    isAuthenticated,
    async (req, res) => {

        try {

            const {
                name,
                fatherName,
                mobile,
                email,
                photo,
                age,
                course,
                address,
                exams
            } = req.body;


            // ===============================
            // Basic Validation
            // ===============================

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


            // ===============================
            // Age Validation
            // ===============================

            if (
                Number(age) < 1 ||
                Number(age) > 100
            ) {
                return res.send(
                    "Please enter a valid age"
                );
            }


            // ===============================
            // Mobile Validation
            // ===============================

            if (!/^[0-9]{10}$/.test(mobile)) {
                return res.send(
                    "Please enter a valid 10 digit mobile number"
                );
            }


            // ===============================
            // Prepare Exams
            // ===============================

            let formattedExams = [];


            if (exams) {

                // Multiple exams
                const examArray =
                    Array.isArray(exams)
                        ? exams
                        : [exams];


                examArray.forEach(exam => {

                    // Empty exam skip
                    if (!exam.examName) {
                        return;
                    }


                    let subjects = [];


                    if (exam.subjects) {

                        // Multiple subjects
                        const subjectArray =
                            Array.isArray(exam.subjects)
                                ? exam.subjects
                                : [exam.subjects];


                        subjectArray.forEach(subject => {

                            // Empty subject skip
                            if (!subject.subjectName) {
                                return;
                            }


                            const totalMarks =
                                Number(subject.totalMarks);

                            const obtainedMarks =
                                Number(subject.obtainedMarks);


                            // ===============================
                            // Total Marks Validation
                            // ===============================

                            if (totalMarks <= 0) {

                                throw new Error(
                                    "Total marks must be greater than 0"
                                );

                            }


                            // ===============================
                            // Obtained Marks Validation
                            // ===============================

                            if (
                                obtainedMarks < 0 ||
                                obtainedMarks > totalMarks
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

                        });

                    }


                    // ===============================
                    // Save Exam
                    // ===============================

                    if (subjects.length > 0) {

                        formattedExams.push({

                            examName:
                                exam.examName,

                            subjects

                        });

                    }

                });

            }


            // ===============================
            // Create Student
            // ===============================

            await Student.create({

                name,

                fatherName,

                mobile,

                email,

                photo: photo || "",

                age: Number(age),

                course,

                address,

                exams: formattedExams

            });


            // ===============================
            // Redirect
            // ===============================

            res.redirect("/students");


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


// ===============================
// Edit Student Page
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
                    .send("Student not found");

            }


            res.render(
                "edit-student",
                {
                    student
                }
            );

        } catch (error) {

            console.log(error);

            res.status(500).send(
                "Error: " + error.message
            );

        }

    }
);


// ===============================
// Edit Student
// ===============================

// ===============================
// Edit Student
// ===============================

app.post(
    "/students/edit/:id",
    isAuthenticated,
    async (req, res) => {

        try {

            const {
                name,
                fatherName,
                mobile,
                email,
                photo,
                age,
                course,
                address,
                exams
            } = req.body;


            // ===============================
            // Basic Validation
            // ===============================

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


            // ===============================
            // Age Validation
            // ===============================

            if (
                Number(age) < 1 ||
                Number(age) > 100
            ) {

                return res.send(
                    "Please enter a valid age"
                );

            }


            // ===============================
            // Mobile Validation
            // ===============================

            if (
                !/^[0-9]{10}$/.test(mobile)
            ) {

                return res.send(
                    "Please enter a valid 10 digit mobile number"
                );

            }


            // ===============================
            // Prepare Exams
            // ===============================

            let formattedExams = [];


            if (exams) {

                // If only one exam is submitted
                // convert it into an array

                const examArray =
                    Array.isArray(exams)
                        ? exams
                        : [exams];


                examArray.forEach(exam => {

                    if (
                        !exam.examName
                    ) {
                        return;
                    }


                    let subjects = [];


                    if (exam.subjects) {

                        const subjectArray =
                            Array.isArray(
                                exam.subjects
                            )
                                ? exam.subjects
                                : [exam.subjects];


                        subjectArray.forEach(subject => {

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


                            // Total marks validation

                            if (
                                totalMarks <= 0
                            ) {

                                throw new Error(
                                    "Total marks must be greater than 0"
                                );

                            }


                            // Obtained marks validation

                            if (
                                obtainedMarks < 0 ||
                                obtainedMarks > totalMarks
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

                        });

                    }


                    // Only save exam if it has subjects

                    if (
                        subjects.length > 0
                    ) {

                        formattedExams.push({

                            examName:
                                exam.examName,

                            subjects

                        });

                    }

                });

            }


            // ===============================
            // Update Student
            // ===============================

            await Student.findByIdAndUpdate(

                req.params.id,

                {

                    name,

                    fatherName,

                    mobile,

                    email,

                    photo: photo || "",

                    age: Number(age),

                    course,

                    address,

                    exams: formattedExams

                },

                {

                    new: true,

                    runValidators: true

                }

            );


            // ===============================
            // Redirect
            // ===============================

            res.redirect("/students");


        } catch (error) {

            console.log(
                "Error updating student:",
                error
            );


            res.status(500).send(
                "Error updating student: " +
                error.message
            );

        }

    }
);


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


            res.redirect("/students");

        } catch (error) {

            console.log(error);

            res.status(500).send(
                "Error deleting student"
            );

        }

    }
);


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


            const studentData =
                student.toObject();


            studentData.progress =
                calculateStudentProgress(
                    student
                );


            res.json(studentData);

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
// Update Student API
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
                        runValidators: true
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


            const studentData =
                student.toObject();


            studentData.progress =
                calculateStudentProgress(
                    student
                );


            res.json({

                message:
                    "Student updated successfully",

                student:
                    studentData

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
// Delete Student API
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

                student:
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


// ===============================
// Server
// ===============================

console.log(
    "STEP 5: starting server"
);


app.listen(
    process.env.PORT || 3000,
    () => {

        console.log(
            "Server started"
        );

    }
);
