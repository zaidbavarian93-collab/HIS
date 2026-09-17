package com.example.hospital.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "patients")
data class Patient(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val fileNumber: String,
    val fullName: String,
    val nationalId: String,
    val phone: String,
    val gender: String,
    val dateOfBirth: String,
    val bloodType: String,
    val allergies: String = "",
    val chronicDiseases: String = "",
    val emergencyContactName: String = "",
    val emergencyContactPhone: String = "",
    val insuranceProvider: String = "",
    val insuranceNumber: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "appointments")
data class Appointment(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val patientId: Long,
    val patientName: String,
    val doctorName: String,
    val department: String,
    val appointmentDate: String,
    val appointmentTime: String,
    val status: String, // Scheduled, Waiting, In Progress, Completed, Cancelled
    val reason: String = "",
    val notes: String = ""
)

@Entity(tableName = "medical_records")
data class MedicalRecord(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val patientId: Long,
    val doctorName: String,
    val visitDate: String,
    val chiefComplaint: String,
    val diagnosis: String,
    val prescription: String,
    val bloodPressure: String = "",
    val temperature: String = "",
    val pulse: String = "",
    val notes: String = ""
)

@Entity(tableName = "invoices")
data class Invoice(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val invoiceNumber: String,
    val patientId: Long,
    val patientName: String,
    val date: String,
    val servicesDescription: String,
    val totalAmount: Double,
    val discountAmount: Double = 0.0,
    val paidAmount: Double = 0.0,
    val status: String, // Paid, Partial, Unpaid
    val paymentMethod: String = "Cash" // Cash, Card, Insurance
)

@Entity(tableName = "medications")
data class Medication(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val scientificName: String,
    val category: String,
    val stockQuantity: Int,
    val unit: String,
    val unitPrice: Double,
    val minAlertQuantity: Int = 15,
    val expiryDate: String
)

@Entity(tableName = "departments")
data class Department(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val nameAr: String,
    val code: String,
    val headDoctor: String,
    val bedCount: Int,
    val phoneExt: String
)

@Entity(tableName = "doctors")
data class Doctor(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val specialty: String,
    val department: String,
    val phone: String,
    val consultationFee: Double,
    val availableDays: String
)

@Entity(tableName = "queue_tickets")
data class QueueTicket(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val ticketNumber: String,
    val patientId: Long,
    val patientName: String,
    val clinicDepartment: String,
    val doctorName: String,
    val status: String, // Waiting, Serving, Completed
    val createdAt: Long = System.currentTimeMillis()
)
