package com.example.hospital.data.dao

import androidx.room.*
import com.example.hospital.data.model.*
import kotlinx.coroutines.flow.Flow

@Dao
interface HospitalDao {
    // Patients
    @Query("SELECT * FROM patients ORDER BY fullName ASC")
    fun getAllPatients(): Flow<List<Patient>>

    @Query("SELECT * FROM patients WHERE id = :id")
    fun getPatientById(id: Long): Flow<Patient?>

    @Query("SELECT * FROM patients WHERE fullName LIKE '%' || :query || '%' OR fileNumber LIKE '%' || :query || '%' OR phone LIKE '%' || :query || '%' OR nationalId LIKE '%' || :query || '%'")
    fun searchPatients(query: String): Flow<List<Patient>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPatient(patient: Patient): Long

    @Update
    suspend fun updatePatient(patient: Patient)

    @Delete
    suspend fun deletePatient(patient: Patient)

    @Query("SELECT COUNT(*) FROM patients")
    fun getPatientsCount(): Flow<Int>

    // Appointments
    @Query("SELECT * FROM appointments ORDER BY appointmentDate DESC, appointmentTime ASC")
    fun getAllAppointments(): Flow<List<Appointment>>

    @Query("SELECT * FROM appointments WHERE appointmentDate = :date ORDER BY appointmentTime ASC")
    fun getAppointmentsByDate(date: String): Flow<List<Appointment>>

    @Query("SELECT * FROM appointments WHERE patientId = :patientId ORDER BY appointmentDate DESC")
    fun getAppointmentsForPatient(patientId: Long): Flow<List<Appointment>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAppointment(appointment: Appointment): Long

    @Update
    suspend fun updateAppointment(appointment: Appointment)

    @Query("UPDATE appointments SET status = :newStatus WHERE id = :id")
    suspend fun updateAppointmentStatus(id: Long, newStatus: String)

    @Delete
    suspend fun deleteAppointment(appointment: Appointment)

    @Query("SELECT COUNT(*) FROM appointments WHERE appointmentDate = :today")
    fun getTodayAppointmentsCount(today: String): Flow<Int>

    // Medical Records
    @Query("SELECT * FROM medical_records WHERE patientId = :patientId ORDER BY visitDate DESC")
    fun getMedicalRecordsForPatient(patientId: Long): Flow<List<MedicalRecord>>

    @Query("SELECT * FROM medical_records ORDER BY visitDate DESC LIMIT 10")
    fun getRecentMedicalRecords(): Flow<List<MedicalRecord>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMedicalRecord(record: MedicalRecord): Long

    // Invoices
    @Query("SELECT * FROM invoices ORDER BY id DESC")
    fun getAllInvoices(): Flow<List<Invoice>>

    @Query("SELECT * FROM invoices WHERE patientId = :patientId ORDER BY id DESC")
    fun getInvoicesForPatient(patientId: Long): Flow<List<Invoice>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertInvoice(invoice: Invoice): Long

    @Update
    suspend fun updateInvoice(invoice: Invoice)

    @Query("SELECT COALESCE(SUM(totalAmount - discountAmount), 0.0) FROM invoices")
    fun getTotalBilledAmount(): Flow<Double>

    @Query("SELECT COALESCE(SUM(paidAmount), 0.0) FROM invoices")
    fun getTotalPaidAmount(): Flow<Double>

    @Query("SELECT COUNT(*) FROM invoices WHERE status != 'Paid'")
    fun getUnpaidInvoicesCount(): Flow<Int>

    // Medications
    @Query("SELECT * FROM medications ORDER BY name ASC")
    fun getAllMedications(): Flow<List<Medication>>

    @Query("SELECT * FROM medications WHERE stockQuantity <= minAlertQuantity")
    fun getLowStockMedications(): Flow<List<Medication>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMedication(medication: Medication): Long

    @Update
    suspend fun updateMedication(medication: Medication)

    @Query("UPDATE medications SET stockQuantity = stockQuantity - :qty WHERE id = :medId AND stockQuantity >= :qty")
    suspend fun dispenseMedication(medId: Long, qty: Int): Int

    @Delete
    suspend fun deleteMedication(medication: Medication)

    // Departments
    @Query("SELECT * FROM departments ORDER BY name ASC")
    fun getAllDepartments(): Flow<List<Department>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDepartment(dept: Department): Long

    // Doctors
    @Query("SELECT * FROM doctors ORDER BY name ASC")
    fun getAllDoctors(): Flow<List<Doctor>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDoctor(doctor: Doctor): Long

    // Queue Tickets
    @Query("SELECT * FROM queue_tickets WHERE status != 'Completed' ORDER BY id ASC")
    fun getActiveQueueTickets(): Flow<List<QueueTicket>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertQueueTicket(ticket: QueueTicket): Long

    @Query("UPDATE queue_tickets SET status = :status WHERE id = :id")
    suspend fun updateTicketStatus(id: Long, status: String)

    @Query("DELETE FROM queue_tickets WHERE id = :id")
    suspend fun removeQueueTicket(id: Long)

    // Batch Seed Helpers
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPatients(patients: List<Patient>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAppointments(appointments: List<Appointment>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMedicalRecords(records: List<MedicalRecord>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertInvoices(invoices: List<Invoice>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMedications(medications: List<Medication>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDepartments(departments: List<Department>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDoctors(doctors: List<Doctor>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertQueueTickets(tickets: List<QueueTicket>)

    @Query("DELETE FROM patients")
    suspend fun clearPatients()
    @Query("DELETE FROM appointments")
    suspend fun clearAppointments()
    @Query("DELETE FROM medical_records")
    suspend fun clearMedicalRecords()
    @Query("DELETE FROM invoices")
    suspend fun clearInvoices()
    @Query("DELETE FROM medications")
    suspend fun clearMedications()
    @Query("DELETE FROM departments")
    suspend fun clearDepartments()
    @Query("DELETE FROM doctors")
    suspend fun clearDoctors()
    @Query("DELETE FROM queue_tickets")
    suspend fun clearQueueTickets()
}
