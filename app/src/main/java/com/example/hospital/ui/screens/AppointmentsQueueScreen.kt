package com.example.hospital.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
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
import com.example.hospital.data.model.QueueTicket
import com.example.hospital.ui.components.EmptyStateCard
import com.example.hospital.ui.components.StatusBadge
import com.example.hospital.ui.theme.*
import com.example.hospital.ui.viewmodel.HospitalViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppointmentsQueueScreen(
    viewModel: HospitalViewModel,
    modifier: Modifier = Modifier
) {
    val isArabic by viewModel.isArabic.collectAsState()
    val appointments by viewModel.filteredAppointments.collectAsState()
    val selectedStatus by viewModel.appointmentFilterStatus.collectAsState()
    val queueTickets by viewModel.activeQueueTickets.collectAsState()
    val patients by viewModel.allPatients.collectAsState()
    val doctors by viewModel.allDoctors.collectAsState()

    var selectedTab by remember { mutableStateOf(0) }
    var showBookDialog by remember { mutableStateOf(false) }
    var showNewTicketDialog by remember { mutableStateOf(false) }

    val statusOptions = listOf("Scheduled", "Waiting", "In Progress", "Completed", "Cancelled")

    Scaffold(
        modifier = modifier.fillMaxSize(),
        floatingActionButton = {
            if (selectedTab == 0) {
                FloatingActionButton(
                    onClick = { showBookDialog = true },
                    containerColor = HospitalPrimary,
                    contentColor = Color.White,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.testTag("book_appt_fab")
                ) {
                    Icon(Icons.Default.CalendarToday, contentDescription = "Book Appointment")
                }
            } else {
                FloatingActionButton(
                    onClick = { showNewTicketDialog = true },
                    containerColor = HospitalTertiary,
                    contentColor = Color.White,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.testTag("issue_ticket_fab")
                ) {
                    Icon(Icons.Default.ConfirmationNumber, contentDescription = "Issue Ticket")
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(12.dp))

            // Main Tab Switcher: Appointments vs Live Queue
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = HospitalPrimary,
                modifier = Modifier.clip(RoundedCornerShape(12.dp))
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CalendarMonth, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(if (isArabic) "جدول المواعيد (${appointments.size})" else "Appointments (${appointments.size})")
                        }
                    }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Sensors, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(if (isArabic) "طابور الانتظار (${queueTickets.size})" else "Live Queue (${queueTickets.size})")
                        }
                    }
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (selectedTab == 0) {
                // Appointments Filter Bar
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    item {
                        FilterChip(
                            selected = selectedStatus == null,
                            onClick = { viewModel.appointmentFilterStatus.value = null },
                            label = { Text(if (isArabic) "الكل" else "All") }
                        )
                    }
                    items(statusOptions) { status ->
                        FilterChip(
                            selected = selectedStatus == status,
                            onClick = {
                                viewModel.appointmentFilterStatus.value =
                                    if (selectedStatus == status) null else status
                            },
                            label = { Text(status) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                if (appointments.isEmpty()) {
                    EmptyStateCard(
                        icon = Icons.Default.EventBusy,
                        title = if (isArabic) "لا توجد مواعيد" else "No Appointments Found",
                        description = if (isArabic) "لا توجد مواعيد مطابقة لهذا التصنيف." else "There are no appointments matching this filter status.",
                        actionButtonText = if (isArabic) "حجز موعد جديد" else "Book New Appointment",
                        onActionClick = { showBookDialog = true }
                    )
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        contentPadding = PaddingValues(bottom = 96.dp)
                    ) {
                        items(appointments, key = { it.id }) { appt ->
                            ManageableAppointmentCard(
                                appt = appt,
                                isArabic = isArabic,
                                onStatusChange = { newStatus ->
                                    viewModel.updateAppointmentStatus(appt.id, newStatus)
                                }
                            )
                        }
                    }
                }
            } else {
                // Live Queue Tab
                val servingTicket = queueTickets.find { it.status == "Serving" }
                val waitingTickets = queueTickets.filter { it.status != "Serving" }

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(bottom = 96.dp)
                ) {
                    // Now Serving Hero Card
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = if (servingTicket != null) HospitalTertiary.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface
                            ),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(20.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(10.dp)
                                            .clip(CircleShape)
                                            .background(if (servingTicket != null) MedicalSuccess else MaterialTheme.colorScheme.outline)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = if (isArabic) "النداء الحالي بالعيادة" else "NOW CALLING / SERVING",
                                        style = MaterialTheme.typography.labelLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = if (servingTicket != null) HospitalTertiary else MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                if (servingTicket != null) {
                                    Text(
                                        text = servingTicket.ticketNumber,
                                        style = MaterialTheme.typography.headlineLarge,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = HospitalTertiary,
                                        fontSize = 38.sp
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = servingTicket.patientName,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${servingTicket.clinicDepartment} • ${servingTicket.doctorName}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Spacer(modifier = Modifier.height(16.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Button(
                                            onClick = { viewModel.updateQueueStatus(servingTicket.id, "Completed") },
                                            colors = ButtonDefaults.buttonColors(containerColor = MedicalSuccess)
                                        ) {
                                            Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(if (isArabic) "إنهاء المعاينة" else "Complete")
                                        }
                                        OutlinedButton(
                                            onClick = {
                                                // Call next
                                                val next = waitingTickets.firstOrNull()
                                                if (next != null) {
                                                    viewModel.updateQueueStatus(servingTicket.id, "Completed")
                                                    viewModel.updateQueueStatus(next.id, "Serving")
                                                }
                                            }
                                        ) {
                                            Icon(Icons.Default.SkipNext, contentDescription = null, modifier = Modifier.size(18.dp))
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(if (isArabic) "النداء التالي" else "Next Ticket")
                                        }
                                    }
                                } else {
                                    Text(
                                        text = if (isArabic) "لا يوجد مريض يتم مناداته حالياً" else "No active ticket currently calling",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    if (waitingTickets.isNotEmpty()) {
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Button(
                                            onClick = {
                                                viewModel.updateQueueStatus(waitingTickets.first().id, "Serving")
                                            }
                                        ) {
                                            Icon(Icons.Default.VolumeUp, contentDescription = null, modifier = Modifier.size(18.dp))
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(if (isArabic) "نداء التذكرة الأولى (${waitingTickets.first().ticketNumber})" else "Call Next (${waitingTickets.first().ticketNumber})")
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Waiting List Header
                    item {
                        Text(
                            text = if (isArabic) "المراجعون في صالة الانتظار (${waitingTickets.size})" else "Waiting in Clinic Lobby (${waitingTickets.size})",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                    }

                    if (waitingTickets.isEmpty()) {
                        item {
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = if (isArabic) "غرف الانتظار فارغة حالياً." else "Lobby queue is currently empty.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(16.dp)
                                )
                            }
                        }
                    } else {
                        items(waitingTickets, key = { it.id }) { ticket ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Surface(
                                            shape = RoundedCornerShape(10.dp),
                                            color = HospitalTertiary.copy(alpha = 0.15f)
                                        ) {
                                            Text(
                                                text = ticket.ticketNumber,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 16.sp,
                                                color = HospitalTertiary,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                            )
                                        }
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Column {
                                            Text(ticket.patientName, fontWeight = FontWeight.Bold)
                                            Text(
                                                text = "${ticket.clinicDepartment} • ${ticket.doctorName}",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                    Button(
                                        onClick = { viewModel.updateQueueStatus(ticket.id, "Serving") },
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                    ) {
                                        Icon(Icons.Default.Campaign, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(if (isArabic) "نداء" else "Call")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showBookDialog) {
        BookNewAppointmentDialog(
            isArabic = isArabic,
            patients = patients,
            doctors = doctors,
            onDismiss = { showBookDialog = false },
            onSave = { pId, pName, docName, dept, date, time, reason, notes ->
                viewModel.bookAppointment(pId, pName, docName, dept, date, time, reason, notes)
                showBookDialog = false
            }
        )
    }

    if (showNewTicketDialog) {
        IssueTicketDialog(
            isArabic = isArabic,
            patients = patients,
            doctors = doctors,
            onDismiss = { showNewTicketDialog = false },
            onSave = { pId, pName, dept, docName ->
                viewModel.addQueueTicket(pId, pName, dept, docName)
                showNewTicketDialog = false
            }
        )
    }
}

@Composable
fun ManageableAppointmentCard(
    appt: Appointment,
    isArabic: Boolean,
    onStatusChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expandedMenu by remember { mutableStateOf(false) }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = appt.patientName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${appt.doctorName} • ${appt.department}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "${appt.appointmentDate} @ ${appt.appointmentTime}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = HospitalPrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Box {
                    IconButton(onClick = { expandedMenu = true }) {
                        StatusBadge(status = appt.status)
                    }
                    DropdownMenu(
                        expanded = expandedMenu,
                        onDismissRequest = { expandedMenu = false }
                    ) {
                        listOf("Scheduled", "Waiting", "In Progress", "Completed", "Cancelled").forEach { st ->
                            DropdownMenuItem(
                                text = { Text(st) },
                                onClick = {
                                    onStatusChange(st)
                                    expandedMenu = false
                                }
                            )
                        }
                    }
                }
            }

            if (appt.reason.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "${if (isArabic) "السبب: " else "Reason: "}${appt.reason}",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
fun BookNewAppointmentDialog(
    isArabic: Boolean,
    patients: List<com.example.hospital.data.model.Patient>,
    doctors: List<com.example.hospital.data.model.Doctor>,
    onDismiss: () -> Unit,
    onSave: (pId: Long, pName: String, docName: String, dept: String, date: String, time: String, reason: String, notes: String) -> Unit
) {
    var selectedPatient by remember { mutableStateOf(patients.firstOrNull()) }
    var selectedDoctor by remember { mutableStateOf(doctors.firstOrNull()) }
    var date by remember { mutableStateOf("2024-09-20") }
    var time by remember { mutableStateOf("10:00 AM") }
    var reason by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp)
        ) {
            LazyColumn(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Text(
                        text = if (isArabic) "حجز موعد استشارة" else "Schedule Appointment",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                item {
                    Text(
                        text = if (isArabic) "اختر المريض:" else "Select Patient:",
                        style = MaterialTheme.typography.labelMedium
                    )
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(patients) { p ->
                            FilterChip(
                                selected = selectedPatient?.id == p.id,
                                onClick = { selectedPatient = p },
                                label = { Text(p.fullName) }
                            )
                        }
                    }
                }

                item {
                    Text(
                        text = if (isArabic) "اختر الطبيب المعالج:" else "Select Doctor:",
                        style = MaterialTheme.typography.labelMedium
                    )
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(doctors) { d ->
                            FilterChip(
                                selected = selectedDoctor?.id == d.id,
                                onClick = { selectedDoctor = d },
                                label = { Text(d.name) }
                            )
                        }
                    }
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = date,
                            onValueChange = { date = it },
                            label = { Text("Date (YYYY-MM-DD)") },
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = time,
                            onValueChange = { time = it },
                            label = { Text("Time") },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                item {
                    OutlinedTextField(
                        value = reason,
                        onValueChange = { reason = it },
                        label = { Text(if (isArabic) "سبب الزيارة *" else "Reason *") },
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
                                val p = selectedPatient
                                val d = selectedDoctor
                                if (p != null && d != null && reason.isNotBlank()) {
                                    onSave(p.id, p.fullName, d.name, d.department, date, time, reason, notes)
                                }
                            },
                            enabled = selectedPatient != null && selectedDoctor != null && reason.isNotBlank()
                        ) {
                            Text(if (isArabic) "تأكيد" else "Confirm")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun IssueTicketDialog(
    isArabic: Boolean,
    patients: List<com.example.hospital.data.model.Patient>,
    doctors: List<com.example.hospital.data.model.Doctor>,
    onDismiss: () -> Unit,
    onSave: (pId: Long, pName: String, dept: String, docName: String) -> Unit
) {
    var selectedPatient by remember { mutableStateOf(patients.firstOrNull()) }
    var selectedDoctor by remember { mutableStateOf(doctors.firstOrNull()) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = if (isArabic) "إصدار تذكرة انتظار جديدة" else "Issue Clinic Queue Ticket",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                Text(if (isArabic) "اختر المريض:" else "Select Patient:")
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(patients) { p ->
                        FilterChip(
                            selected = selectedPatient?.id == p.id,
                            onClick = { selectedPatient = p },
                            label = { Text(p.fullName) }
                        )
                    }
                }

                Text(if (isArabic) "اختر العيادة / الطبيب:" else "Select Clinic / Doctor:")
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(doctors) { d ->
                        FilterChip(
                            selected = selectedDoctor?.id == d.id,
                            onClick = { selectedDoctor = d },
                            label = { Text("${d.name} (${d.department})") }
                        )
                    }
                }

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
                            val p = selectedPatient
                            val d = selectedDoctor
                            if (p != null && d != null) {
                                onSave(p.id, p.fullName, d.department, d.name)
                            }
                        },
                        enabled = selectedPatient != null && selectedDoctor != null
                    ) {
                        Text(if (isArabic) "طباعة وإصدار" else "Print & Issue")
                    }
                }
            }
        }
    }
}
