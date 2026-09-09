require("dotenv").config();
console.log("STEP 1: dotenv loaded");
const express = require("express");
const mongoose = require("mongoose");

const Student = require("./models/Student");
console.log("STEP 2: packages loaded");



const app = express();
console.log("STEP 3: app created");
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

// Home
app.get("/", (req, res) => {
    res.redirect("/students");
});

// POST - Add Student
app.post("/students", async (req, res) => {
    try {
        const student = await Student.create(req.body);

        res.redirect("/students");

    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});
app.post("/students/edit/:id", async (req, res) => {
    try {
        await Student.findByIdAndUpdate(
            req.params.id,
            req.body
        );

        res.redirect("/students");

    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});
app.post("/students/delete/:id", async (req, res) => {
    try {
        await Student.findByIdAndDelete(req.params.id);

        res.redirect("/students");

    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});
app.get("/students/add", (req, res) => {
    res.render("add-student");
});
app.get("/students", async (req, res) => {
    try {
        const students = await Student.find();

        res.render("students", {
            students: students
        });

    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});
app.get("/students/edit/:id", async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).send("Student not found");
        }

        res.render("edit-student", {
            student: student
        });

    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});
app.get("/students/:id", async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);

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
app.put("/students/:id", async (req, res) => {
    try {
        const student = await Student.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
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
app.delete("/students/:id", async (req, res) => {
    try {
        const student = await Student.findByIdAndDelete(req.params.id);

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


// Server
console.log("STEP 5: starting server");
app.listen(process.env.PORT || 3000, () => {
    console.log("Server started");
});