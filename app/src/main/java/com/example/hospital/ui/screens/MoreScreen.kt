package com.example.hospital.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.hospital.data.model.Department
import com.example.hospital.data.model.Doctor
import com.example.hospital.ui.components.SectionHeader
import com.example.hospital.ui.theme.HospitalPrimary
import com.example.hospital.ui.theme.MedicalDanger
import com.example.hospital.ui.viewmodel.HospitalViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreScreen(
    viewModel: HospitalViewModel,
    modifier: Modifier = Modifier
) {
    val isArabic by viewModel.isArabic.collectAsState()
    val isDarkMode by viewModel.isDarkMode.collectAsState()
    val departments by viewModel.allDepartments.collectAsState()
    val doctors by viewModel.allDoctors.collectAsState()

    var showResetConfirmDialog by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 12.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // App Preferences
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = if (isArabic) "إعدادات النظام والواجهة" else "System & Display Settings",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    // Language Toggle
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Language, contentDescription = null, tint = HospitalPrimary)
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(if (isArabic) "لغة الواجهة" else "Language", fontWeight = FontWeight.SemiBold)
                                Text(if (isArabic) "العربية (الحالية)" else "English (Current)", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        Switch(
                            checked = isArabic,
                            onCheckedChange = { viewModel.toggleLanguage() },
                            modifier = Modifier.testTag("language_switch")
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                    Spacer(modifier = Modifier.height(12.dp))

                    // Dark Mode Toggle
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.DarkMode, contentDescription = null, tint = HospitalPrimary)
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(if (isArabic) "الوضع الليلي" else "Dark Theme", fontWeight = FontWeight.SemiBold)
                                Text(if (isDarkMode) "Enabled" else "Disabled", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        Switch(
                            checked = isDarkMode,
                            onCheckedChange = { viewModel.toggleDarkMode() },
                            modifier = Modifier.testTag("dark_mode_switch")
                        )
                    }
                }
            }
        }

        // Departments Directory
        item {
            SectionHeader(
                title = if (isArabic) "أقسام وأجنحة المستشفى" else "Hospital Clinical Departments",
                subtitle = if (isArabic) "الأقسام المعتمدة وسعة الأسرّة" else "Authorized wards, beds, and contact extensions"
            )
        }

        items(departments, key = { it.id }) { dept ->
            DepartmentCard(dept = dept, isArabic = isArabic)
        }

        // Doctors Directory
        item {
            SectionHeader(
                title = if (isArabic) "الكادر الطبي والاستشاريين" else "Medical Staff & Consultants",
                subtitle = if (isArabic) "الأطباء والعيادات التخصصية" else "Attending specialists and clinic schedules"
            )
        }

        items(doctors, key = { it.id }) { doc ->
            DoctorCard(doc = doc, isArabic = isArabic)
        }

        // Database Maintenance & Reset
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = if (isArabic) "صيانة البيانات وتجربة النظام" else "Database Maintenance & Demo Data",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = if (isArabic) "استعادة البيانات التجريبية الشاملة (مرضى، أدوية، مواعيد، فواتير، أطباء)." else "Restore standard hospital demo dataset with patients, records, medications, and invoices.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    OutlinedButton(
                        onClick = { showResetConfirmDialog = true },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MedicalDanger),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.RestartAlt, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(if (isArabic) "إعادة تعيين البيانات الافتراضية" else "Reset to Factory Demo Data")
                    }
                }
            }
        }
    }

    if (showResetConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showResetConfirmDialog = false },
            title = { Text(if (isArabic) "تأكيد إعادة تعيين البيانات" else "Confirm Data Reset") },
            text = { Text(if (isArabic) "هل أنت متأكد من استعادة البيانات النموذجية للمستشفى؟" else "This will reload the initial demo data.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.resetDemoData()
                        showResetConfirmDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MedicalDanger)
                ) {
                    Text(if (isArabic) "تأكيد الاستعادة" else "Reset")
                }
            },
            dismissButton = {
                TextButton(onClick = { showResetConfirmDialog = false }) {
                    Text(if (isArabic) "إلغاء" else "Cancel")
                }
            }
        )
    }
}

@Composable
fun DepartmentCard(
    dept: Department,
    isArabic: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = dept.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Text(
                        text = "Ext: ${dept.phoneExt}",
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "${dept.nameAr} • Code: ${dept.code}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "${if (isArabic) "رئيس القسم: " else "Head: "}${dept.headDoctor} • ${if (isArabic) "سعة الأسرّة: " else "Beds: "}${dept.bedCount}",
                style = MaterialTheme.typography.labelSmall,
                color = HospitalPrimary,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
fun DoctorCard(
    doc: Doctor,
    isArabic: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
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
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = doc.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${doc.specialty} • ${doc.department}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "${if (isArabic) "أيام العمل: " else "Schedule: "}${doc.availableDays}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.surfaceVariant
            ) {
                Text(
                    text = "$${String.format("%.0f", doc.consultationFee)}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = HospitalPrimary,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
        }
    }
}
