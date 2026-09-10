const mongoose = require("mongoose");

// ===============================
// Subject Schema
// ===============================

const subjectSchema = new mongoose.Schema({
    subjectName: {
        type: String,
        required: true
    },

    totalMarks: {
        type: Number,
        required: true,
        min: 1
    },

    obtainedMarks: {
        type: Number,
        required: true,
        min: 0
    }
});


// ===============================
// Exam Schema
// ===============================

const examSchema = new mongoose.Schema({
    examName: {
        type: String,
        required: true
    },

    subjects: {
        type: [subjectSchema],
        default: []
    }
});


// ===============================
// Student Schema
// ===============================

const studentSchema = new mongoose.Schema({

    // Student Name
    name: {
        type: String,
        required: true
    },

    // Father Name
    fatherName: {
        type: String,
        required: true
    },

    // Mobile Number
    mobile: {
        type: String,
        required: true
    },

    // Email
    email: {
        type: String,
        required: true
    },

    // Student Photo URL
    photo: {
        type: String,
        default: ""
    },

    // Age
    age: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },

    // Course
    course: {
        type: String,
        required: true
    },

    // Address - City ki jagah
    address: {
        type: String,
        required: true
    },

    // Exams
    exams: {
        type: [examSchema],
        default: []
    }

});


// ===============================
// Student Model
// ===============================

const Student = mongoose.model("Student", studentSchema);

module.exports = Student;
