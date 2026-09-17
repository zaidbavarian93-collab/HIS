package com.example.hospital.ui.navigation

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.hospital.ui.screens.*
import com.example.hospital.ui.theme.HospitalPrimary
import com.example.hospital.ui.theme.HospitalSecondary
import com.example.hospital.ui.theme.HospitalTertiary
import com.example.hospital.ui.theme.MedicalDanger
import com.example.hospital.ui.viewmodel.HospitalViewModel

sealed class Screen {
    data object Dashboard : Screen()
    data object Patients : Screen()
    data class PatientDetail(val patientId: Long) : Screen()
    data object AppointmentsQueue : Screen()
    data object Pharmacy : Screen()
    data object Billing : Screen()
    data object More : Screen()
}

enum class NavigationItem(
    val titleEn: String,
    val titleAr: String,
    val icon: ImageVector,
    val tag: String
) {
    DASHBOARD("Dashboard", "الرئيسية", Icons.Default.Dashboard, "nav_dashboard"),
    PATIENTS("Patients", "المرضى", Icons.Default.People, "nav_patients"),
    APPOINTMENTS("Appointments", "المواعيد", Icons.Default.EventNote, "nav_appointments"),
    PHARMACY("Pharmacy", "الصيدلية", Icons.Default.LocalPharmacy, "nav_pharmacy"),
    BILLING("Billing", "الفواتير", Icons.Default.ReceiptLong, "nav_billing"),
    MORE("More", "المزيد", Icons.Default.MoreHoriz, "nav_more")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HospitalApp(
    viewModel: HospitalViewModel,
    modifier: Modifier = Modifier
) {
    val isArabic by viewModel.isArabic.collectAsState()
    val isDarkMode by viewModel.isDarkMode.collectAsState()
    val queueTickets by viewModel.activeQueueTickets.collectAsState()
    val lowStockMeds by viewModel.lowStockMedications.collectAsState()

    var currentScreen by remember { mutableStateOf<Screen>(Screen.Dashboard) }

    val activeNav = when (currentScreen) {
        Screen.Dashboard -> NavigationItem.DASHBOARD
        Screen.Patients, is Screen.PatientDetail -> NavigationItem.PATIENTS
        Screen.AppointmentsQueue -> NavigationItem.APPOINTMENTS
        Screen.Pharmacy -> NavigationItem.PHARMACY
        Screen.Billing -> NavigationItem.BILLING
        Screen.More -> NavigationItem.MORE
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            if (currentScreen !is Screen.PatientDetail) {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(HospitalPrimary),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.LocalHospital,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = if (isArabic) "مستشفى السلام الطبي" else "Al Salam Hospital",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = if (isArabic) "نظام السجلات والمعلومات السريرية" else "Hospital Information System",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    },
                    actions = {
                        // Queue badge shortcut
                        IconButton(
                            onClick = { currentScreen = Screen.AppointmentsQueue },
                            modifier = Modifier.testTag("topbar_queue_button")
                        ) {
                            BadgedBox(
                                badge = {
                                    if (queueTickets.isNotEmpty()) {
                                        Badge(
                                            containerColor = HospitalTertiary,
                                            contentColor = Color.White
                                        ) {
                                            Text(queueTickets.size.toString())
                                        }
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Sensors,
                                    contentDescription = "Active Queue",
                                    tint = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }

                        // Language Switcher
                        TextButton(
                            onClick = { viewModel.toggleLanguage() },
                            modifier = Modifier.testTag("topbar_language_button")
                        ) {
                            Text(
                                text = if (isArabic) "EN" else "عربي",
                                fontWeight = FontWeight.Bold,
                                color = HospitalPrimary
                            )
                        }

                        // Dark Mode Switcher
                        IconButton(
                            onClick = { viewModel.toggleDarkMode() },
                            modifier = Modifier.testTag("topbar_darkmode_button")
                        ) {
                            Icon(
                                imageVector = if (isDarkMode) Icons.Default.LightMode else Icons.Default.DarkMode,
                                contentDescription = "Toggle Dark Mode",
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.background
                    )
                )
            }
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 8.dp,
                modifier = Modifier.testTag("bottom_nav_bar")
            ) {
                NavigationItem.entries.forEach { item ->
                    val isSelected = activeNav == item
                    val title = if (isArabic) item.titleAr else item.titleEn

                    NavigationBarItem(
                        selected = isSelected,
                        onClick = {
                            currentScreen = when (item) {
                                NavigationItem.DASHBOARD -> Screen.Dashboard
                                NavigationItem.PATIENTS -> Screen.Patients
                                NavigationItem.APPOINTMENTS -> Screen.AppointmentsQueue
                                NavigationItem.PHARMACY -> Screen.Pharmacy
                                NavigationItem.BILLING -> Screen.Billing
                                NavigationItem.MORE -> Screen.More
                            }
                        },
                        icon = {
                            BadgedBox(
                                badge = {
                                    if (item == NavigationItem.PHARMACY && lowStockMeds.isNotEmpty()) {
                                        Badge(containerColor = MedicalDanger) {
                                            Text("!")
                                        }
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = item.icon,
                                    contentDescription = title
                                )
                            }
                        },
                        label = {
                            Text(
                                text = title,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                maxLines = 1
                            )
                        },
                        modifier = Modifier.testTag(item.tag),
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = HospitalPrimary,
                            selectedTextColor = HospitalPrimary,
                            indicatorColor = HospitalPrimary.copy(alpha = 0.15f)
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        AnimatedContent(
            targetState = currentScreen,
            transitionSpec = { fadeIn() togetherWith fadeOut() },
            label = "screen_transition",
            modifier = Modifier.padding(innerPadding)
        ) { screen ->
            when (screen) {
                Screen.Dashboard -> DashboardScreen(
                    viewModel = viewModel,
                    onNavigateToPatients = { currentScreen = Screen.Patients },
                    onNavigateToAppointments = { currentScreen = Screen.AppointmentsQueue },
                    onNavigateToPharmacy = { currentScreen = Screen.Pharmacy },
                    onNavigateToBilling = { currentScreen = Screen.Billing },
                    onNavigateToQueue = { currentScreen = Screen.AppointmentsQueue }
                )
                Screen.Patients -> PatientsScreen(
                    viewModel = viewModel,
                    onPatientClick = { id -> currentScreen = Screen.PatientDetail(id) }
                )
                is Screen.PatientDetail -> PatientDetailScreen(
                    viewModel = viewModel,
                    patientId = screen.patientId,
                    onBack = { currentScreen = Screen.Patients }
                )
                Screen.AppointmentsQueue -> AppointmentsQueueScreen(
                    viewModel = viewModel
                )
                Screen.Pharmacy -> PharmacyScreen(
                    viewModel = viewModel
                )
                Screen.Billing -> BillingScreen(
                    viewModel = viewModel
                )
                Screen.More -> MoreScreen(
                    viewModel = viewModel
                )
            }
        }
    }
}
