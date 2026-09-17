package com.example.hospital.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.hospital.data.db.HospitalDatabase
import com.example.hospital.data.model.*
import com.example.hospital.data.repository.HospitalRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class HospitalViewModel(application: Application) : AndroidViewModel(application) {

    private val repository: HospitalRepository

    val isDarkMode = MutableStateFlow(false)
    val isArabic = MutableStateFlow(true) // Arabic default like original HIS web app

    // Search and Filters
    val patientSearchQuery = MutableStateFlow("")
    val selectedBloodTypeFilter = MutableStateFlow<String?>(null)
    val selectedPatientId = MutableStateFlow<Long?>(null)

    val medSearchQuery = MutableStateFlow("")
    val selectedMedCategory = MutableStateFlow<String?>(null)

    val appointmentFilterStatus = MutableStateFlow<String?>(null)

    // Data streams
    val allPatients: StateFlow<List<Patient>>
    val allAppointments: StateFlow<List<Appointment>>
    val recentRecords: StateFlow<List<MedicalRecord>>
    val allInvoices: StateFlow<List<Invoice>>
    val allMedications: StateFlow<List<Medication>>
    val lowStockMedications: StateFlow<List<Medication>>
    val allDepartments: StateFlow<List<Department>>
    val allDoctors: StateFlow<List<Doctor>>
    val activeQueueTickets: StateFlow<List<QueueTicket>>

    val totalBilled: StateFlow<Double>
    val totalPaid: StateFlow<Double>
    val unpaidCount: StateFlow<Int>
    val patientsCount: StateFlow<Int>

    init {
        val db = HospitalDatabase.getDatabase(application, viewModelScope)
        repository = HospitalRepository(db.hospitalDao())

        allPatients = repository.allPatients
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

        allAppointments = repository.allAppointments
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

        recentRecords = repository.recentMedicalRecords
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

        allInvoices = repository.allInvoices
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

        allMedications = repository.allMedications
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

        lowStockMedications = repository.lowStockMedications
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

        allDepartments = repository.allDepartments
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

        allDoctors = repository.allDoctors
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

        activeQueueTickets = repository.activeQueueTickets
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

        totalBilled = repository.totalBilled
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

        totalPaid = repository.totalPaid
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

        unpaidCount = repository.unpaidCount
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

        patientsCount = repository.patientsCount
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)
    }

    // Derived Patient List
    val filteredPatients: StateFlow<List<Patient>> = combine(
        allPatients,
        patientSearchQuery,
        selectedBloodTypeFilter
    ) { patients, query, bloodType ->
        patients.filter { p ->
            val matchesQuery = query.isBlank() ||
                    p.fullName.contains(query, ignoreCase = true) ||
                    p.fileNumber.contains(query, ignoreCase = true) ||
                    p.phone.contains(query, ignoreCase = true) ||
                    p.nationalId.contains(query, ignoreCase = true)
            val matchesBlood = bloodType == null || p.bloodType.equals(bloodType, ignoreCase = true)
            matchesQuery && matchesBlood
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Selected Patient details
    val selectedPatient: StateFlow<Patient?> = combine(
        allPatients,
        selectedPatientId
    ) { patients, id ->
        patients.find { it.id == id }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val selectedPatientRecords: StateFlow<List<MedicalRecord>> = selectedPatientId.flatMapLatest { id ->
        if (id == null) flowOf(emptyList()) else repository.getMedicalRecordsForPatient(id)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val selectedPatientAppointments: StateFlow<List<Appointment>> = selectedPatientId.flatMapLatest { id ->
        if (id == null) flowOf(emptyList()) else repository.getAppointmentsForPatient(id)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val selectedPatientInvoices: StateFlow<List<Invoice>> = selectedPatientId.flatMapLatest { id ->
        if (id == null) flowOf(emptyList()) else repository.getInvoicesForPatient(id)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Filtered Medications
    val filteredMedications: StateFlow<List<Medication>> = combine(
        allMedications,
        medSearchQuery,
        selectedMedCategory
    ) { meds, query, category ->
        meds.filter { m ->
            val matchesQuery = query.isBlank() ||
                    m.name.contains(query, ignoreCase = true) ||
                    m.scientificName.contains(query, ignoreCase = true)
            val matchesCat = category == null || m.category.equals(category, ignoreCase = true)
            matchesQuery && matchesCat
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Filtered Appointments
    val filteredAppointments: StateFlow<List<Appointment>> = combine(
        allAppointments,
        appointmentFilterStatus
    ) { appts, status ->
        if (status == null) appts else appts.filter { it.status.equals(status, ignoreCase = true) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Actions
    fun toggleDarkMode() {
        isDarkMode.value = !isDarkMode.value
    }

    fun toggleLanguage() {
        isArabic.value = !isArabic.value
    }

    fun selectPatient(id: Long?) {
        selectedPatientId.value = id
    }

    fun addPatient(
        fullName: String,
        nationalId: String,
        phone: String,
        gender: String,
        dateOfBirth: String,
        bloodType: String,
        allergies: String,
        chronicDiseases: String,
        emergencyContactName: String,
        emergencyContactPhone: String,
        insuranceProvider: String,
        insuranceNumber: String,
        onSuccess: (Long) -> Unit = {}
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            val count = allPatients.value.size + 1
            val fileNumber = "MRN-${1000 + count}"
            val newPatient = Patient(
                fileNumber = fileNumber,
                fullName = fullName,
                nationalId = nationalId,
                phone = phone,
                gender = gender,
                dateOfBirth = dateOfBirth,
                bloodType = bloodType,
                allergies = allergies,
                chronicDiseases = chronicDiseases,
                emergencyContactName = emergencyContactName,
                emergencyContactPhone = emergencyContactPhone,
                insuranceProvider = insuranceProvider,
                insuranceNumber = insuranceNumber
            )
            val id = repository.insertPatient(newPatient)
            onSuccess(id)
        }
    }

    fun addMedicalRecord(
        patientId: Long,
        doctorName: String,
        visitDate: String,
        chiefComplaint: String,
        diagnosis: String,
        prescription: String,
        bloodPressure: String,
        temperature: String,
        pulse: String,
        notes: String
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            val record = MedicalRecord(
                patientId = patientId,
                doctorName = doctorName,
                visitDate = visitDate.ifBlank { LocalDate.now().toString() },
                chiefComplaint = chiefComplaint,
                diagnosis = diagnosis,
                prescription = prescription,
                bloodPressure = bloodPressure,
                temperature = temperature,
                pulse = pulse,
                notes = notes
            )
            repository.insertMedicalRecord(record)
        }
    }

    fun bookAppointment(
        patientId: Long,
        patientName: String,
        doctorName: String,
        department: String,
        date: String,
        time: String,
        reason: String,
        notes: String
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            val appt = Appointment(
                patientId = patientId,
                patientName = patientName,
                doctorName = doctorName,
                department = department,
                appointmentDate = date,
                appointmentTime = time,
                status = "Scheduled",
                reason = reason,
                notes = notes
            )
            repository.insertAppointment(appt)
        }
    }

    fun updateAppointmentStatus(id: Long, newStatus: String) {
        viewModelScope.launch(Dispatchers.IO) {
            repository.updateAppointmentStatus(id, newStatus)
        }
    }

    fun createInvoice(
        patientId: Long,
        patientName: String,
        servicesDescription: String,
        totalAmount: Double,
        discountAmount: Double,
        paidAmount: Double,
        paymentMethod: String
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            val count = allInvoices.value.size + 1
            val invoiceNumber = "INV-2024-${String.format("%03d", count)}"
            val net = totalAmount - discountAmount
            val status = when {
                paidAmount >= net -> "Paid"
                paidAmount > 0.0 -> "Partial"
                else -> "Unpaid"
            }
            val inv = Invoice(
                invoiceNumber = invoiceNumber,
                patientId = patientId,
                patientName = patientName,
                date = LocalDate.now().toString(),
                servicesDescription = servicesDescription,
                totalAmount = totalAmount,
                discountAmount = discountAmount,
                paidAmount = paidAmount,
                status = status,
                paymentMethod = paymentMethod
            )
            repository.insertInvoice(inv)
        }
    }

    fun recordInvoicePayment(invoice: Invoice, paymentToAdd: Double) {
        viewModelScope.launch(Dispatchers.IO) {
            val newPaid = (invoice.paidAmount + paymentToAdd).coerceAtMost(invoice.totalAmount - invoice.discountAmount)
            val net = invoice.totalAmount - invoice.discountAmount
            val newStatus = if (newPaid >= net) "Paid" else "Partial"
            val updated = invoice.copy(paidAmount = newPaid, status = newStatus)
            repository.updateInvoice(updated)
        }
    }

    fun dispenseMedication(medId: Long, quantity: Int, onResult: (Boolean) -> Unit) {
        viewModelScope.launch(Dispatchers.IO) {
            val success = repository.dispenseMedication(medId, quantity)
            onResult(success)
        }
    }

    fun addMedication(
        name: String,
        scientificName: String,
        category: String,
        stockQuantity: Int,
        unit: String,
        unitPrice: Double,
        minAlertQuantity: Int,
        expiryDate: String
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            val med = Medication(
                name = name,
                scientificName = scientificName,
                category = category,
                stockQuantity = stockQuantity,
                unit = unit,
                unitPrice = unitPrice,
                minAlertQuantity = minAlertQuantity,
                expiryDate = expiryDate
            )
            repository.insertMedication(med)
        }
    }

    fun addQueueTicket(
        patientId: Long,
        patientName: String,
        department: String,
        doctorName: String
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            val count = activeQueueTickets.value.size + 1
            val deptPrefix = department.take(3).uppercase()
            val ticketNumber = "$deptPrefix-${100 + count}"
            val ticket = QueueTicket(
                ticketNumber = ticketNumber,
                patientId = patientId,
                patientName = patientName,
                clinicDepartment = department,
                doctorName = doctorName,
                status = "Waiting"
            )
            repository.insertQueueTicket(ticket)
        }
    }

    fun updateQueueStatus(ticketId: Long, status: String) {
        viewModelScope.launch(Dispatchers.IO) {
            if (status == "Completed") {
                repository.removeQueueTicket(ticketId)
            } else {
                repository.updateTicketStatus(ticketId, status)
            }
        }
    }

    fun resetDemoData() {
        viewModelScope.launch(Dispatchers.IO) {
            repository.resetToSeedData()
        }
    }
}
