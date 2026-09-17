package com.example.hospital.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.hospital.data.model.Appointment
import com.example.hospital.data.model.MedicalRecord
import com.example.hospital.ui.components.SectionHeader
import com.example.hospital.ui.components.StatCard
import com.example.hospital.ui.components.StatusBadge
import com.example.hospital.ui.theme.*
import com.example.hospital.ui.viewmodel.HospitalViewModel
import java.time.LocalDate

@Composable
fun DashboardScreen(
    viewModel: HospitalViewModel,
    onNavigateToPatients: () -> Unit,
    onNavigateToAppointments: () -> Unit,
    onNavigateToPharmacy: () -> Unit,
    onNavigateToBilling: () -> Unit,
    onNavigateToQueue: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isArabic by viewModel.isArabic.collectAsState()
    val patientsCount by viewModel.patientsCount.collectAsState()
    val appointments by viewModel.allAppointments.collectAsState()
    val queueTickets by viewModel.activeQueueTickets.collectAsState()
    val lowStockMeds by viewModel.lowStockMedications.collectAsState()
    val unpaidInvoicesCount by viewModel.unpaidCount.collectAsState()
    val totalBilled by viewModel.totalBilled.collectAsState()
    val recentRecords by viewModel.recentRecords.collectAsState()

    val todayStr = LocalDate.now().toString()
    val todayAppointments = appointments.filter { it.appointmentDate == todayStr }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Hero Hospital Banner
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("dashboard_hero_banner"),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.Transparent)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            brush = Brush.horizontalGradient(
                                colors = listOf(HospitalPrimary, HospitalPrimaryDark, HospitalSecondary)
                            )
                        )
                        .padding(20.dp)
                ) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = if (isArabic) "نظام إدارة المستشفى الذكي" else "Hospital Information System",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Text(
                                    text = if (isArabic) "مركز القيادة والعمليات السريرية" else "Clinical & Operational Control Center",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color.White.copy(alpha = 0.85f)
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color.White.copy(alpha = 0.2f)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .clip(CircleShape)
                                            .background(MedicalSuccess)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = if (isArabic) "متصل بالسيرفر" else "Online",
                                        color = Color.White,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Quick stats pills inside banner
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            BannerMetric(
                                label = if (isArabic) "مواعيد اليوم" else "Today's Appts",
                                value = todayAppointments.size.toString(),
                                modifier = Modifier.weight(1f)
                            )
                            BannerMetric(
                                label = if (isArabic) "في قائمة الانتظار" else "In Queue",
                                value = queueTickets.size.toString(),
                                modifier = Modifier.weight(1f)
                            )
                            BannerMetric(
                                label = if (isArabic) "تنبيهات الأدوية" else "Stock Alerts",
                                value = lowStockMeds.size.toString(),
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }

        // Quick Actions Grid
        item {
            Column {
                SectionHeader(
                    title = if (isArabic) "الإجراءات السريعة" else "Quick Actions",
                    subtitle = if (isArabic) "الوصول المباشر للخدمات السريرية" else "Instant clinical workflows"
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    QuickActionButton(
                        title = if (isArabic) "تسجيل مريض" else "New Patient",
                        icon = Icons.Default.PersonAdd,
                        accent = HospitalPrimary,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToPatients
                    )
                    QuickActionButton(
                        title = if (isArabic) "حجز موعد" else "Book Appt",
                        icon = Icons.Default.CalendarToday,
                        accent = HospitalSecondary,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToAppointments
                    )
                    QuickActionButton(
                        title = if (isArabic) "نداء الطابور" else "Live Queue",
                        icon = Icons.Default.ConfirmationNumber,
                        accent = HospitalTertiary,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToQueue
                    )
                    QuickActionButton(
                        title = if (isArabic) "صرف دواء" else "Dispense",
                        icon = Icons.Default.Medication,
                        accent = MedicalSuccess,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToPharmacy
                    )
                }
            }
        }

        // Hospital KPIs
        item {
            Column {
                SectionHeader(
                    title = if (isArabic) "مؤشرات الأداء الرئيسية" else "Hospital Performance Metrics",
                    subtitle = if (isArabic) "ملخص عام للحركة اليومية والمالية" else "Summary of patients, pharmacy and finances"
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        title = if (isArabic) "إجمالي المرضى" else "Total Patients",
                        value = patientsCount.toString(),
                        subtitle = if (isArabic) "ملفات نشطة" else "Active MRNs",
                        icon = Icons.Default.People,
                        accentColor = HospitalPrimary,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToPatients
                    )
                    StatCard(
                        title = if (isArabic) "فواتير غير مدفوعة" else "Unpaid Invoices",
                        value = unpaidInvoicesCount.toString(),
                        subtitle = if (isArabic) "تحتاج تحصيل" else "Requires Payment",
                        icon = Icons.Default.ReceiptLong,
                        accentColor = if (unpaidInvoicesCount > 0) MedicalWarning else MedicalSuccess,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToBilling
                    )
                }
            }
        }

        // Live Queue Banner (if active)
        if (queueTickets.isNotEmpty()) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToQueue() },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(HospitalTertiary.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Sensors,
                                    contentDescription = null,
                                    tint = HospitalTertiary
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = if (isArabic) "شاشة الانتظار المباشرة" else "Active Queue Board",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = if (isArabic) "${queueTickets.size} مريض في غرف الانتظار" else "${queueTickets.size} patients awaiting call",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        Button(
                            onClick = onNavigateToQueue,
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(if (isArabic) "إدارة" else "Manage")
                        }
                    }
                }
            }
        }

        // Today's Appointments Section
        item {
            SectionHeader(
                title = if (isArabic) "مواعيد اليوم" else "Today's Appointments",
                subtitle = if (isArabic) "قائمة المراجعين لليوم الحالي" else "Scheduled consultations for today",
                actionText = if (isArabic) "عرض الكل" else "View All",
                onActionClick = onNavigateToAppointments
            )
        }

        if (todayAppointments.isEmpty()) {
            item {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                ) {
                    Text(
                        text = if (isArabic) "لا توجد مواعيد مجدولة لليوم حتى الآن" else "No appointments scheduled for today yet",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        } else {
            items(todayAppointments.take(3)) { appt ->
                AppointmentCard(appt = appt, isArabic = isArabic)
            }
        }

        // Recent Clinical Records
        if (recentRecords.isNotEmpty()) {
            item {
                SectionHeader(
                    title = if (isArabic) "آخر المعاينات الطبية" else "Recent Clinical Consultations",
                    subtitle = if (isArabic) "أحدث السجلات الطبية المسجلة" else "Latest diagnoses and clinical notes"
                )
            }
            items(recentRecords.take(3)) { record ->
                ClinicalRecordCard(record = record, isArabic = isArabic)
            }
        }
    }
}

@Composable
fun BannerMetric(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        color = Color.White.copy(alpha = 0.18f)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.85f),
                maxLines = 1
            )
        }
    }
}

@Composable
fun QuickActionButton(
    title: String,
    icon: ImageVector,
    accent: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier.clickable { onClick() },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(accent.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accent,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1
            )
        }
    }
}

@Composable
fun AppointmentCard(
    appt: Appointment,
    isArabic: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
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
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(HospitalPrimary.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = appt.patientName.take(1).uppercase(),
                        fontWeight = FontWeight.Bold,
                        color = HospitalPrimary,
                        fontSize = 18.sp
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
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
                        text = "${appt.appointmentTime} • ${appt.reason}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
            StatusBadge(status = appt.status)
        }
    }
}

@Composable
fun ClinicalRecordCard(
    record: MedicalRecord,
    isArabic: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = record.diagnosis,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = record.visitDate,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "${record.doctorName} • ${if (isArabic) "الشكوى:" else "Complaint:"} ${record.chiefComplaint}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (record.bloodPressure.isNotBlank() || record.pulse.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (record.bloodPressure.isNotBlank()) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant
                        ) {
                            Text(
                                text = "BP: ${record.bloodPressure}",
                                style = MaterialTheme.typography.labelSmall,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                    if (record.pulse.isNotBlank()) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant
                        ) {
                            Text(
                                text = "HR: ${record.pulse}",
                                style = MaterialTheme.typography.labelSmall,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
