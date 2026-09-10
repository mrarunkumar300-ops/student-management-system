require("dotenv").config();


console.log("STEP 1: dotenv loaded");
const bcrypt = require("bcryptjs");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");

const Student = require("./models/Student");

console.log("STEP 2: packages loaded");

const app = express();

console.log("STEP 3: app created");

// Session
app.use(session({
    secret: "student-management-secret",
    resave: false,
    saveUninitialized: false
}));

app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// MongoDB connection
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

    const { username, password } = req.body;

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
// Dashboard
// ===============================

app.get("/dashboard", isAuthenticated, async (req, res) => {

    try {

        const totalStudents = await Student.countDocuments();

        const courses = await Student.distinct("course");

        const cities = await Student.distinct("city");


        // Course-wise count
        const courseCounts = await Student.aggregate([

            {
                $group: {
                    _id: "$course",
                    count: { $sum: 1 }
                }
            },

            {
                $sort: {
                    count: -1
                }
            }

        ]);


        // City-wise count
        const cityCounts = await Student.aggregate([

            {
                $group: {
                    _id: "$city",
                    count: { $sum: 1 }
                }
            },

            {
                $sort: {
                    count: -1
                }
            }

        ]);


        res.render("dashboard", {

            totalStudents,

            totalCourses: courses.length,

            totalCities: cities.length,

            courseCounts,

            cityCounts

        });


    } catch (error) {

        console.log(error);

        res.send("Error loading dashboard");

    }

});


// ===============================
// Home
// ===============================

app.get("/", (req, res) => {

    if (req.session.isLoggedIn) {

        res.redirect("/dashboard");

    } else {

        res.redirect("/login");

    }

});


// ===============================
// Students List
// ===============================

app.get("/students", isAuthenticated, async (req, res) => {

    try {

        const search = req.query.search || "";

        const course = req.query.course || "";

        const city = req.query.city || "";


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
                    course: {
                        $regex: search,
                        $options: "i"
                    }
                },

                {
                    city: {
                        $regex: search,
                        $options: "i"
                    }
                }

            ];

        }


        // Course filter
        if (course) {

            filter.course = course;

        }


        // City filter
        if (city) {

            filter.city = city;

        }


        const students = await Student.find(filter);

        const courses = await Student.distinct("course");

        const cities = await Student.distinct("city");


        res.render("students", {

            students,

            search,

            courses,

            cities,

            selectedCourse: course,

            selectedCity: city

        });


    } catch (error) {

        console.log(error);

        res.send("Error loading students");

    }

});


// ===============================
// Add Student Page
// ===============================

app.get("/students/add", isAuthenticated, (req, res) => {

    res.render("add-student");

});


// ===============================
// Add Student
// ===============================

app.post("/students", isAuthenticated, async (req, res) => {

    try {

        const {
            name,
            age,
            course,
            city
        } = req.body;


        if (!name || !age || !course || !city) {

            return res.send("Please fill all fields");

        }


        if (age < 1 || age > 100) {

            return res.send("Please enter a valid age");

        }


        await Student.create({

            name,

            age,

            course,

            city

        });


        res.redirect("/students");


    } catch (error) {

        console.log(error);

        res.send("Error adding student");

    }

});


// ===============================
// Edit Student Page
// ===============================

app.get("/students/edit/:id", isAuthenticated, async (req, res) => {

    try {

        const student = await Student.findById(req.params.id);


        if (!student) {

            return res.status(404).send("Student not found");

        }


        res.render("edit-student", {

            student: student

        });


    } catch (error) {

        res.status(500).send(
            "Error: " + error.message
        );

    }

});


// ===============================
// Edit Student
// ===============================

app.post("/students/edit/:id", isAuthenticated, async (req, res) => {

    try {

        const {
            name,
            age,
            course,
            city
        } = req.body;


        if (!name || !age || !course || !city) {

            return res.send("Please fill all fields");

        }


        if (age < 1 || age > 100) {

            return res.send("Please enter a valid age");

        }


        await Student.findByIdAndUpdate(

            req.params.id,

            {
                name,
                age,
                course,
                city
            }

        );


        res.redirect("/students");


    } catch (error) {

        console.log(error);

        res.send("Error updating student");

    }

});


// ===============================
// Delete Student
// ===============================

app.post("/students/delete/:id", isAuthenticated, async (req, res) => {

    try {

        await Student.findByIdAndDelete(req.params.id);

        res.redirect("/students");


    } catch (error) {

        res.status(500).send(
            "Error: " + error.message
        );

    }

});


// ===============================
// Get Student API
// ===============================

app.get("/students/:id", isAuthenticated, async (req, res) => {

    try {

        const student = await Student.findById(
            req.params.id
        );


        if (!student) {

            return res.status(404).json({

                message: "Student not found"

            });

        }


        res.json(student);


    } catch (error) {

        res.status(500).json({

            message: "Invalid student ID",

            error: error.message

        });

    }

});


// ===============================
// Update Student API
// ===============================

app.put("/students/:id", isAuthenticated, async (req, res) => {

    try {

        const student =
            await Student.findByIdAndUpdate(

                req.params.id,

                req.body,

                {
                    new: true
                }

            );


        if (!student) {

            return res.status(404).json({

                message: "Student not found"

            });

        }


        res.json({

            message: "Student updated successfully",

            student: student

        });


    } catch (error) {

        res.status(500).json({

            message: "Error",

            error: error.message

        });

    }

});


// ===============================
// Delete Student API
// ===============================

app.delete("/students/:id", isAuthenticated, async (req, res) => {

    try {

        const student =
            await Student.findByIdAndDelete(
                req.params.id
            );


        if (!student) {

            return res.status(404).json({

                message: "Student not found"

            });

        }


        res.json({

            message: "Student deleted successfully",

            student: student

        });


    } catch (error) {

        res.status(500).json({

            message: "Error",

            error: error.message

        });

    }

});


// ===============================
// Server
// ===============================

console.log("STEP 5: starting server");

app.listen(process.env.PORT || 3000, () => {

    console.log("Server started");

});