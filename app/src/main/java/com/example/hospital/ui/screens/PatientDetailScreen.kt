package com.example.hospital.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.hospital.data.model.Appointment
import com.example.hospital.data.model.Invoice
import com.example.hospital.data.model.MedicalRecord
import com.example.hospital.ui.components.EmptyStateCard
import com.example.hospital.ui.components.StatusBadge
import com.example.hospital.ui.theme.*
import com.example.hospital.ui.viewmodel.HospitalViewModel
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PatientDetailScreen(
    viewModel: HospitalViewModel,
    patientId: Long,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isArabic by viewModel.isArabic.collectAsState()
    val patient by viewModel.selectedPatient.collectAsState()
    val records by viewModel.selectedPatientRecords.collectAsState()
    val appointments by viewModel.selectedPatientAppointments.collectAsState()
    val invoices by viewModel.selectedPatientInvoices.collectAsState()
    val doctors by viewModel.allDoctors.collectAsState()

    LaunchedEffect(patientId) {
        viewModel.selectPatient(patientId)
    }

    var selectedTab by remember { mutableStateOf(0) }
    var showAddRecordDialog by remember { mutableStateOf(false) }
    var showBookApptDialog by remember { mutableStateOf(false) }

    val currentPatient = patient

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = currentPatient?.fullName ?: (if (isArabic) "ملف المريض" else "Patient Profile"),
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    if (currentPatient != null) {
                        IconButton(
                            onClick = {
                                val doc = doctors.firstOrNull()
                                viewModel.addQueueTicket(
                                    patientId = currentPatient.id,
                                    patientName = currentPatient.fullName,
                                    department = doc?.department ?: "General Clinic",
                                    doctorName = doc?.name ?: "Duty Physician"
                                )
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.ConfirmationNumber,
                                contentDescription = "Queue Ticket",
                                tint = HospitalTertiary
                            )
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            if (selectedTab == 0) {
                FloatingActionButton(
                    onClick = { showAddRecordDialog = true },
                    containerColor = HospitalPrimary,
                    contentColor = Color.White,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.testTag("add_medical_record_fab")
                ) {
                    Icon(Icons.Default.AddComment, contentDescription = "Add Consultation")
                }
            } else if (selectedTab == 1) {
                FloatingActionButton(
                    onClick = { showBookApptDialog = true },
                    containerColor = HospitalSecondary,
                    contentColor = Color.White,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.testTag("book_patient_appt_fab")
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Book Appointment")
                }
            }
        }
    ) { innerPadding ->
        if (currentPatient == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 16.dp),
                contentPadding = PaddingValues(bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Patient Summary Card
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(52.dp)
                                            .clip(CircleShape)
                                            .background(HospitalPrimary.copy(alpha = 0.15f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = currentPatient.fullName.take(1).uppercase(),
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 22.sp,
                                            color = HospitalPrimary
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(14.dp))
                                    Column {
                                        Text(
                                            text = currentPatient.fullName,
                                            style = MaterialTheme.typography.titleLarge,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "${currentPatient.fileNumber} • ${currentPatient.gender} • DOB: ${currentPatient.dateOfBirth}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }

                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = HospitalSecondary.copy(alpha = 0.15f)
                                ) {
                                    Text(
                                        text = currentPatient.bloodType,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = HospitalSecondary,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(14.dp))
                            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                            Spacer(modifier = Modifier.height(12.dp))

                            // Contact & Insurance Info
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = if (isArabic) "الهاتف" else "Phone",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Text(
                                        text = currentPatient.phone,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = if (isArabic) "جهة التأمين" else "Insurance",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Text(
                                        text = currentPatient.insuranceProvider.ifBlank { "N/A" },
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }

                            if (currentPatient.emergencyContactName.isNotBlank()) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "${if (isArabic) "جهة اتصال الطوارئ: " else "Emergency: "}${currentPatient.emergencyContactName} (${currentPatient.emergencyContactPhone})",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            // Allergies Alert Banner (CRITICAL)
                            if (currentPatient.allergies.isNotBlank()) {
                                Spacer(modifier = Modifier.height(12.dp))
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = MedicalDangerBg,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Warning,
                                            contentDescription = "Allergy Warning",
                                            tint = MedicalDanger,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Column {
                                            Text(
                                                text = if (isArabic) "تحذير حساسية طبية مسجلة!" else "Medical Allergy Alert!",
                                                style = MaterialTheme.typography.labelMedium,
                                                fontWeight = FontWeight.Bold,
                                                color = MedicalDanger
                                            )
                                            Text(
                                                text = currentPatient.allergies,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MedicalDanger
                                            )
                                        }
                                    }
                                }
                            }

                            // Chronic conditions banner
                            if (currentPatient.chronicDiseases.isNotBlank()) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = MedicalWarningBg,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Info,
                                            contentDescription = null,
                                            tint = MedicalWarning,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "${if (isArabic) "أمراض مزمنة: " else "Chronic: "}${currentPatient.chronicDiseases}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MedicalWarning,
                                            fontWeight = FontWeight.Medium
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Tabs: Medical Records / Appointments / Invoices
                item {
                    TabRow(
                        selectedTabIndex = selectedTab,
                        containerColor = MaterialTheme.colorScheme.surface,
                        contentColor = HospitalPrimary
                    ) {
                        Tab(
                            selected = selectedTab == 0,
                            onClick = { selectedTab = 0 },
                            text = { Text(if (isArabic) "السجل الطبي (${records.size})" else "EHR (${records.size})") }
                        )
                        Tab(
                            selected = selectedTab == 1,
                            onClick = { selectedTab = 1 },
                            text = { Text(if (isArabic) "المواعيد (${appointments.size})" else "Appts (${appointments.size})") }
                        )
                        Tab(
                            selected = selectedTab == 2,
                            onClick = { selectedTab = 2 },
                            text = { Text(if (isArabic) "الفواتير (${invoices.size})" else "Bills (${invoices.size})") }
                        )
                    }
                }

                // Tab Content
                when (selectedTab) {
                    0 -> {
                        if (records.isEmpty()) {
                            item {
                                EmptyStateCard(
                                    icon = Icons.Default.MedicalInformation,
                                    title = if (isArabic) "لا توجد معاينات سابقة" else "No Consultations Yet",
                                    description = if (isArabic) "اضغط على زر الإضافة لتسجيل تشخيص جديد وخطة علاج." else "Tap the button below to add clinical notes, vitals, and prescriptions.",
                                    actionButtonText = if (isArabic) "إضافة معاينة طبية" else "Add Consultation",
                                    onActionClick = { showAddRecordDialog = true }
                                )
                            }
                        } else {
                            items(records, key = { it.id }) { record ->
                                DetailedRecordCard(record = record, isArabic = isArabic)
                            }
                        }
                    }
                    1 -> {
                        if (appointments.isEmpty()) {
                            item {
                                EmptyStateCard(
                                    icon = Icons.Default.EventBusy,
                                    title = if (isArabic) "لا توجد مواعيد لهذا المريض" else "No Appointments Found",
                                    description = if (isArabic) "يمكنك حجز موعد جديد في أي قسم طبي." else "You can schedule a new consultation with any hospital doctor.",
                                    actionButtonText = if (isArabic) "حجز موعد" else "Book Appointment",
                                    onActionClick = { showBookApptDialog = true }
                                )
                            }
                        } else {
                            items(appointments, key = { it.id }) { appt ->
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(14.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(
                                                text = "${appt.appointmentDate} • ${appt.appointmentTime}",
                                                style = MaterialTheme.typography.titleMedium,
                                                fontWeight = FontWeight.Bold
                                            )
                                            Text(
                                                text = "${appt.doctorName} (${appt.department})",
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                            if (appt.reason.isNotBlank()) {
                                                Text(
                                                    text = appt.reason,
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.primary
                                                )
                                            }
                                        }
                                        StatusBadge(status = appt.status)
                                    }
                                }
                            }
                        }
                    }
                    2 -> {
                        if (invoices.isEmpty()) {
                            item {
                                EmptyStateCard(
                                    icon = Icons.Default.Receipt,
                                    title = if (isArabic) "لا توجد فواتير مسجلة" else "No Invoices Issued",
                                    description = if (isArabic) "لم يتم إصدار فواتير نقدية أو تأمينية لهذا المريض بعد." else "No invoices or receipts have been recorded for this patient."
                                )
                            }
                        } else {
                            items(invoices, key = { it.id }) { inv ->
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(14.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(
                                                text = inv.invoiceNumber,
                                                style = MaterialTheme.typography.titleMedium,
                                                fontWeight = FontWeight.Bold
                                            )
                                            Text(
                                                text = "${inv.servicesDescription} • ${inv.date}",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                            Text(
                                                text = "${if (isArabic) "المدفوع: " else "Paid: "}$${inv.paidAmount} / $${inv.totalAmount - inv.discountAmount}",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = HospitalPrimary,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                        }
                                        StatusBadge(status = inv.status)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddRecordDialog && currentPatient != null) {
        AddClinicalRecordDialog(
            isArabic = isArabic,
            doctors = doctors.map { it.name },
            onDismiss = { showAddRecordDialog = false },
            onSave = { docName, visitDate, complaint, diagnosis, prescription, bp, temp, pulse, notes ->
                viewModel.addMedicalRecord(
                    patientId = currentPatient.id,
                    doctorName = docName,
                    visitDate = visitDate,
                    chiefComplaint = complaint,
                    diagnosis = diagnosis,
                    prescription = prescription,
                    bloodPressure = bp,
                    temperature = temp,
                    pulse = pulse,
                    notes = notes
                )
                showAddRecordDialog = false
            }
        )
    }

    if (showBookApptDialog && currentPatient != null) {
        BookAppointmentDialog(
            isArabic = isArabic,
            doctors = doctors,
            onDismiss = { showBookApptDialog = false },
            onSave = { docName, dept, date, time, reason, notes ->
                viewModel.bookAppointment(
                    patientId = currentPatient.id,
                    patientName = currentPatient.fullName,
                    doctorName = docName,
                    department = dept,
                    date = date,
                    time = time,
                    reason = reason,
                    notes = notes
                )
                showBookApptDialog = false
            }
        )
    }
}

@Composable
fun DetailedRecordCard(
    record: MedicalRecord,
    isArabic: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = record.diagnosis,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "${record.doctorName} • ${record.visitDate}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Vitals Row
            if (record.bloodPressure.isNotBlank() || record.temperature.isNotBlank() || record.pulse.isNotBlank()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (record.bloodPressure.isNotBlank()) {
                        VitalChip(label = "BP", value = record.bloodPressure)
                    }
                    if (record.temperature.isNotBlank()) {
                        VitalChip(label = "Temp", value = record.temperature)
                    }
                    if (record.pulse.isNotBlank()) {
                        VitalChip(label = "HR", value = record.pulse)
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))
            }

            if (record.chiefComplaint.isNotBlank()) {
                Text(
                    text = "${if (isArabic) "الشكوى الرئيسية: " else "Chief Complaint: "}${record.chiefComplaint}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(6.dp))
            }

            if (record.prescription.isNotBlank()) {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = MedicalInfoBg.copy(alpha = 0.6f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Medication,
                                contentDescription = null,
                                tint = HospitalPrimary,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (isArabic) "الوصفة الطبية والعلاج:" else "Prescriptions & Medications:",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = HospitalPrimary
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = record.prescription,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            if (record.notes.isNotBlank()) {
                Text(
                    text = "${if (isArabic) "ملاحظات الطبيب: " else "Notes: "}${record.notes}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun VitalChip(label: String, value: String) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "$label: ",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = value,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
fun AddClinicalRecordDialog(
    isArabic: Boolean,
    doctors: List<String>,
    onDismiss: () -> Unit,
    onSave: (
        docName: String,
        visitDate: String,
        complaint: String,
        diagnosis: String,
        prescription: String,
        bp: String,
        temp: String,
        pulse: String,
        notes: String
    ) -> Unit
) {
    var selectedDoctor by remember { mutableStateOf(doctors.firstOrNull() ?: "Dr. Specialist") }
    var visitDate by remember { mutableStateOf(LocalDate.now().toString()) }
    var complaint by remember { mutableStateOf("") }
    var diagnosis by remember { mutableStateOf("") }
    var prescription by remember { mutableStateOf("") }
    var bp by remember { mutableStateOf("120/80 mmHg") }
    var temp by remember { mutableStateOf("37.0 °C") }
    var pulse by remember { mutableStateOf("72 bpm") }
    var notes by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Text(
                        text = if (isArabic) "تسجيل معاينة وتشخيص طبي" else "Add Clinical Consultation Record",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                item {
                    OutlinedTextField(
                        value = selectedDoctor,
                        onValueChange = { selectedDoctor = it },
                        label = { Text(if (isArabic) "اسم الطبيب المعالج *" else "Attending Physician *") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = bp,
                            onValueChange = { bp = it },
                            label = { Text("Blood Pressure") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = temp,
                            onValueChange = { temp = it },
                            label = { Text("Temperature") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = pulse,
                            onValueChange = { pulse = it },
                            label = { Text("Heart Rate") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                }

                item {
                    OutlinedTextField(
                        value = complaint,
                        onValueChange = { complaint = it },
                        label = { Text(if (isArabic) "الشكوى السريرية *" else "Chief Complaint *") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    OutlinedTextField(
                        value = diagnosis,
                        onValueChange = { diagnosis = it },
                        label = { Text(if (isArabic) "التشخيص الطبي النهائي *" else "Clinical Diagnosis *") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    OutlinedTextField(
                        value = prescription,
                        onValueChange = { prescription = it },
                        label = { Text(if (isArabic) "الوصفة الدوائية وخطة العلاج" else "Prescription & Regimen") },
                        placeholder = { Text("1. Drug name, dose, frequency...") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3
                    )
                }

                item {
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text(if (isArabic) "ملاحظات إضافية وتوصيات" else "Clinical Advice & Follow-up Notes") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        TextButton(onClick = onDismiss) {
                            Text(if (isArabic) "إلغاء" else "Cancel")
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                if (diagnosis.isNotBlank() && complaint.isNotBlank()) {
                                    onSave(selectedDoctor, visitDate, complaint, diagnosis, prescription, bp, temp, pulse, notes)
                                }
                            },
                            enabled = diagnosis.isNotBlank() && complaint.isNotBlank()
                        ) {
                            Text(if (isArabic) "حفظ السجل" else "Save EHR")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun BookAppointmentDialog(
    isArabic: Boolean,
    doctors: List<com.example.hospital.data.model.Doctor>,
    onDismiss: () -> Unit,
    onSave: (docName: String, dept: String, date: String, time: String, reason: String, notes: String) -> Unit
) {
    var selectedDoctor by remember { mutableStateOf(doctors.firstOrNull()) }
    var date by remember { mutableStateOf(LocalDate.now().plusDays(1).toString()) }
    var time by remember { mutableStateOf("10:00 AM") }
    var reason by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = if (isArabic) "حجز موعد استشارة جديدة" else "Book Consultation Appointment",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = if (isArabic) "اختر الطبيب المعالج:" else "Select Physician:",
                    style = MaterialTheme.typography.labelMedium
                )
                LazyColumn(modifier = Modifier.height(120.dp)) {
                    items(doctors) { doc ->
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (selectedDoctor?.id == doc.id) HospitalPrimary.copy(alpha = 0.15f) else Color.Transparent,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 2.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text(doc.name, fontWeight = FontWeight.Bold)
                                    Text("${doc.specialty} • ${doc.department}", style = MaterialTheme.typography.bodySmall)
                                }
                                Button(
                                    onClick = { selectedDoctor = doc },
                                    enabled = selectedDoctor?.id != doc.id,
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text(if (selectedDoctor?.id == doc.id) "Selected" else "Pick")
                                }
                            }
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = date,
                        onValueChange = { date = it },
                        label = { Text(if (isArabic) "التاريخ (YYYY-MM-DD)" else "Date") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = time,
                        onValueChange = { time = it },
                        label = { Text(if (isArabic) "الوقت" else "Time") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }

                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text(if (isArabic) "سبب الاستشارة *" else "Reason for Visit *") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text(if (isArabic) "ملاحظات إضافية" else "Notes") },
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text(if (isArabic) "إلغاء" else "Cancel")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val doc = selectedDoctor
                            if (doc != null && reason.isNotBlank()) {
                                onSave(doc.name, doc.department, date, time, reason, notes)
                            }
                        },
                        enabled = selectedDoctor != null && reason.isNotBlank()
                    ) {
                        Text(if (isArabic) "تأكيد الحجز" else "Confirm Booking")
                    }
                }
            }
        }
    }
}
