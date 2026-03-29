/**
 * Global Schema Definition for School Management System
 * Used by AI to understand data structure for Reports and Data Entry.
 */

const APP_SCHEMA = {
    users: {
        description: "Authentication and User Roles",
        fields: {
            email: { type: "string", required: true },
            role: { type: "string", enum: ["admin", "teacher", "student"], required: true },
            createdAt: { type: "timestamp" }
        }
    },
    students: {
        description: "Student Records",
        fields: {
            firstName: { type: "string", required: true },
            lastName: { type: "string", required: true },
            admissionNo: { type: "string", unique: true, required: true },
            admissionClass: { type: "string", required: true, description: "Class/Grade e.g. '10', '5'" },
            section: { type: "string", description: "Section e.g. 'A', 'B'" },
            parentName: { type: "string", required: true },
            parentPhone: { type: "string", required: true },
            studentEmail: { type: "string" },
            dob: { type: "date" },
            address: { type: "string" },
            gender: { type: "string", enum: ["Male", "Female", "Other"] }
        }
    },
    teachers: {
        description: "Teacher Records",
        fields: {
            firstName: { type: "string", required: true },
            lastName: { type: "string", required: true },
            employeeId: { type: "string", unique: true, required: true },
            email: { type: "string", required: true },
            phone: { type: "string", required: true },
            subject: { type: "string", description: "Primary Subject" },
            qualification: { type: "string" },
            joinDate: { type: "date" },
            salary: { type: "number", description: "Basic Salary" }
        }
    },
    classes: {
        description: "Class/Grade Definitions",
        fields: {
            name: { type: "string", required: true, description: "e.g. 'Class 10'" },
            section: { type: "string", required: true },
            teacherId: { type: "string", description: "Class Teacher ID" }
        }
    },
    subjects: {
        description: "Subjects taught",
        fields: {
            name: { type: "string", required: true },
            code: { type: "string" },
            department: { type: "string" },
            term: { type: "string", enum: ["Foundation Course", "First Term", "Second Term", "Annual"] },
            book: { type: "string" },
            authorPublisher: { type: "string" },
            description: { type: "string" }
        }
    },
    attendance: {
        description: "Daily Attendance Records",
        fields: {
            studentId: { type: "string", required: true },
            date: { type: "string", format: "YYYY-MM-DD", required: true },
            status: { type: "string", enum: ["Present", "Absent", "Late", "Leave"], required: true },
            markedBy: { type: "string", description: "Teacher/Admin ID" }
        }
    },
    timetable: {
        description: "Class Schedules",
        fields: {
            classId: { type: "string", required: true },
            className: { type: "string" },
            day: { type: "string", enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
            startTime: { type: "string", format: "HH:mm" },
            endTime: { type: "string", format: "HH:mm" },
            subject: { type: "string", required: true },
            teacherId: { type: "string", required: true },
            room: { type: "string" }
        }
    },
    fees: {
        description: "Fee Records and Payments",
        fields: {
            studentId: { type: "string", required: true },
            studentName: { type: "string" },
            amount: { type: "number", required: true },
            type: { type: "string", description: "Tuition, Transport, Exam, etc." },
            dueDate: { type: "date" },
            status: { type: "string", enum: ["Paid", "Pending", "Overdue"] },
            paidDate: { type: "date" },
            receiptNo: { type: "string" }
        }
    },
    finance: {
        description: "Income and Expenses (General Ledger)",
        fields: {
            type: { type: "string", enum: ["income", "expense"], required: true },
            category: { type: "string", required: true },
            amount: { type: "number", required: true },
            description: { type: "string" },
            date: { type: "date", required: true },
            paymentMethod: { type: "string", enum: ["Cash", "Bank", "Online"] }
        }
    },
    payroll: {
        description: "Staff Salary Records",
        fields: {
            staffId: { type: "string", required: true },
            month: { type: "string", required: true },
            year: { type: "number", required: true },
            basicSalary: { type: "number" },
            allowances: { type: "number" },
            deductions: { type: "number" },
            netSalary: { type: "number" },
            status: { type: "string", enum: ["Draft", "Paid"] },
            generatedAt: { type: "timestamp" }
        }
    },
    leaves: {
        description: "Staff Leave Applications",
        fields: {
            staffId: { type: "string", required: true },
            leaveType: { type: "string", enum: ["Sick", "Casual", "Earned", "Unpaid"] },
            startDate: { type: "date", required: true },
            endDate: { type: "date", required: true },
            reason: { type: "string" },
            status: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
            appliedAt: { type: "timestamp" }
        }
    },
    inventory: {
        description: "Inventory Items",
        fields: {
            itemName: { type: "string", required: true },
            category: { type: "string" },
            quantity: { type: "number", required: true },
            unit: { type: "string", description: "pcs, kg, box" },
            unitPrice: { type: "number" },
            minStock: { type: "number", description: "Low stock alert level" },
            location: { type: "string" }
        }
    },
    inventoryTransactions: {
        description: "Inventory Movements",
        fields: {
            itemId: { type: "string", required: true },
            type: { type: "string", enum: ["Purchase", "Issue", "Consume"] },
            quantity: { type: "number", required: true },
            date: { type: "timestamp" },
            performedBy: { type: "string" },
            notes: { type: "string" }
        }
    },
    events: {
        description: "School Events & Calendar",
        fields: {
            title: { type: "string", required: true },
            description: { type: "string" },
            date: { type: "date", required: true },
            type: { type: "string", enum: ["Academic", "Holiday", "Sports", "Cultural"] },
            audience: { type: "string", enum: ["All", "Teachers", "Students"] }
        }
    },
    notices: {
        description: "Notice Board",
        fields: {
            title: { type: "string", required: true },
            content: { type: "string", required: true },
            date: { type: "timestamp" },
            targetAudience: { type: "string", enum: ["All", "Teachers", "Parents"] },
            author: { type: "string" }
        }
    },
    results: {
        description: "Exam Results",
        fields: {
            examId: { type: "string", required: true },
            studentId: { type: "string", required: true },
            subject: { type: "string", required: true },
            marksObtained: { type: "number", required: true },
            totalMarks: { type: "number", required: true },
            grade: { type: "string" }
        }
    }
};

/**
 * Helper to get a simplified schema string for the AI prompt
 */
function getSchemaSummary() {
    let summary = "DATABASE SCHEMAS (Use these field names for data entry):\n";
    for (const [collection, schema] of Object.entries(APP_SCHEMA)) {
        summary += `\nCollection: '${collection}' (${schema.description})\nFields: ${JSON.stringify(schema.fields)}\n`;
    }
    return summary;
}
