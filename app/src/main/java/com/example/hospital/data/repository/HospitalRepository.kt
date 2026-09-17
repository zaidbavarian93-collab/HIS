package com.example.hospital.data.repository

import com.example.hospital.data.dao.HospitalDao
import com.example.hospital.data.db.HospitalDatabase
import com.example.hospital.data.model.*
import kotlinx.coroutines.flow.Flow

class HospitalRepository(private val dao: HospitalDao) {

    // Patients
    val allPatients: Flow<List<Patient>> = dao.getAllPatients()
    val patientsCount: Flow<Int> = dao.getPatientsCount()

    fun getPatientById(id: Long): Flow<Patient?> = dao.getPatientById(id)
    fun searchPatients(query: String): Flow<List<Patient>> = dao.searchPatients(query)

    suspend fun insertPatient(patient: Patient): Long = dao.insertPatient(patient)
    suspend fun updatePatient(patient: Patient) = dao.updatePatient(patient)
    suspend fun deletePatient(patient: Patient) = dao.deletePatient(patient)

    // Appointments
    val allAppointments: Flow<List<Appointment>> = dao.getAllAppointments()
    fun getAppointmentsByDate(date: String): Flow<List<Appointment>> = dao.getAppointmentsByDate(date)
    fun getAppointmentsForPatient(patientId: Long): Flow<List<Appointment>> = dao.getAppointmentsForPatient(patientId)
    fun getTodayAppointmentsCount(today: String): Flow<Int> = dao.getTodayAppointmentsCount(today)

    suspend fun insertAppointment(appointment: Appointment): Long = dao.insertAppointment(appointment)
    suspend fun updateAppointment(appointment: Appointment) = dao.updateAppointment(appointment)
    suspend fun updateAppointmentStatus(id: Long, status: String) = dao.updateAppointmentStatus(id, status)
    suspend fun deleteAppointment(appointment: Appointment) = dao.deleteAppointment(appointment)

    // Medical Records
    val recentMedicalRecords: Flow<List<MedicalRecord>> = dao.getRecentMedicalRecords()
    fun getMedicalRecordsForPatient(patientId: Long): Flow<List<MedicalRecord>> = dao.getMedicalRecordsForPatient(patientId)
    suspend fun insertMedicalRecord(record: MedicalRecord): Long = dao.insertMedicalRecord(record)

    // Invoices
    val allInvoices: Flow<List<Invoice>> = dao.getAllInvoices()
    val totalBilled: Flow<Double> = dao.getTotalBilledAmount()
    val totalPaid: Flow<Double> = dao.getTotalPaidAmount()
    val unpaidCount: Flow<Int> = dao.getUnpaidInvoicesCount()

    fun getInvoicesForPatient(patientId: Long): Flow<List<Invoice>> = dao.getInvoicesForPatient(patientId)
    suspend fun insertInvoice(invoice: Invoice): Long = dao.insertInvoice(invoice)
    suspend fun updateInvoice(invoice: Invoice) = dao.updateInvoice(invoice)

    // Medications
    val allMedications: Flow<List<Medication>> = dao.getAllMedications()
    val lowStockMedications: Flow<List<Medication>> = dao.getLowStockMedications()
    suspend fun insertMedication(med: Medication): Long = dao.insertMedication(med)
    suspend fun updateMedication(med: Medication) = dao.updateMedication(med)
    suspend fun dispenseMedication(id: Long, quantity: Int): Boolean {
        val rows = dao.dispenseMedication(id, quantity)
        return rows > 0
    }
    suspend fun deleteMedication(med: Medication) = dao.deleteMedication(med)

    // Departments & Doctors
    val allDepartments: Flow<List<Department>> = dao.getAllDepartments()
    val allDoctors: Flow<List<Doctor>> = dao.getAllDoctors()
    suspend fun insertDepartment(dept: Department): Long = dao.insertDepartment(dept)
    suspend fun insertDoctor(doctor: Doctor): Long = dao.insertDoctor(doctor)

    // Queue
    val activeQueueTickets: Flow<List<QueueTicket>> = dao.getActiveQueueTickets()
    suspend fun insertQueueTicket(ticket: QueueTicket): Long = dao.insertQueueTicket(ticket)
    suspend fun updateTicketStatus(id: Long, status: String) = dao.updateTicketStatus(id, status)
    suspend fun removeQueueTicket(id: Long) = dao.removeQueueTicket(id)

    // Reset Data
    suspend fun resetToSeedData() {
        HospitalDatabase.seedDemoData(dao)
    }
}
