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
import com.example.hospital.data.model.Patient
import com.example.hospital.ui.components.EmptyStateCard
import com.example.hospital.ui.components.SearchInputBar
import com.example.hospital.ui.theme.*
import com.example.hospital.ui.viewmodel.HospitalViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PatientsScreen(
    viewModel: HospitalViewModel,
    onPatientClick: (Long) -> Unit,
    modifier: Modifier = Modifier
) {
    val isArabic by viewModel.isArabic.collectAsState()
    val searchQuery by viewModel.patientSearchQuery.collectAsState()
    val selectedBloodType by viewModel.selectedBloodTypeFilter.collectAsState()
    val patients by viewModel.filteredPatients.collectAsState()

    var showAddDialog by remember { mutableStateOf(false) }

    val bloodTypes = listOf("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")

    Scaffold(
        modifier = modifier.fillMaxSize(),
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = HospitalPrimary,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.testTag("add_patient_fab")
            ) {
                Icon(Icons.Default.PersonAdd, contentDescription = "Add Patient")
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

            // Search Bar
            SearchInputBar(
                query = searchQuery,
                onQueryChange = { viewModel.patientSearchQuery.value = it },
                placeholder = if (isArabic) "بحث بالاسم، رقم الملف، الهاتف، الرقم الوطني..." else "Search by name, MRN, phone, national ID..."
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Blood Type Filter Chips
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                item {
                    FilterChip(
                        selected = selectedBloodType == null,
                        onClick = { viewModel.selectedBloodTypeFilter.value = null },
                        label = { Text(if (isArabic) "الكل" else "All") },
                        shape = RoundedCornerShape(10.dp)
                    )
                }
                items(bloodTypes) { bt ->
                    FilterChip(
                        selected = selectedBloodType == bt,
                        onClick = {
                            viewModel.selectedBloodTypeFilter.value =
                                if (selectedBloodType == bt) null else bt
                        },
                        label = { Text(bt) },
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (patients.isEmpty()) {
                EmptyStateCard(
                    icon = Icons.Default.PersonSearch,
                    title = if (isArabic) "لم يتم العثور على مرضى" else "No Patients Found",
                    description = if (isArabic) "جرّب تغيير كلمات البحث أو أضف مريضًا جديدًا." else "Try adjusting your search criteria or register a new patient.",
                    actionButtonText = if (isArabic) "تسجيل مريض جديد" else "Register Patient",
                    onActionClick = { showAddDialog = true },
                    modifier = Modifier.padding(top = 24.dp)
                )
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 96.dp)
                ) {
                    items(patients, key = { it.id }) { patient ->
                        PatientListItemCard(
                            patient = patient,
                            isArabic = isArabic,
                            onClick = { onPatientClick(patient.id) }
                        )
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AddPatientDialog(
            isArabic = isArabic,
            onDismiss = { showAddDialog = false },
            onSave = { fullName, nationalId, phone, gender, dob, bloodType, allergies, chronic, ecName, ecPhone, insProvider, insNumber ->
                viewModel.addPatient(
                    fullName = fullName,
                    nationalId = nationalId,
                    phone = phone,
                    gender = gender,
                    dateOfBirth = dob,
                    bloodType = bloodType,
                    allergies = allergies,
                    chronicDiseases = chronic,
                    emergencyContactName = ecName,
                    emergencyContactPhone = ecPhone,
                    insuranceProvider = insProvider,
                    insuranceNumber = insNumber
                ) { newId ->
                    showAddDialog = false
                    onPatientClick(newId)
                }
            }
        )
    }
}

@Composable
fun PatientListItemCard(
    patient: Patient,
    isArabic: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .testTag("patient_item_${patient.id}"),
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
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(HospitalPrimary.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = patient.fullName.take(1).uppercase(),
                            fontWeight = FontWeight.Bold,
                            color = HospitalPrimary,
                            fontSize = 20.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = patient.fullName,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant
                            ) {
                                Text(
                                    text = patient.fileNumber,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = HospitalPrimary,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                            Text(
                                text = "${patient.gender} • ${patient.phone}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                // Blood type badge
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = HospitalSecondary.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = patient.bloodType,
                        color = HospitalSecondary,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            // Alerts row (Allergies or Chronic Diseases)
            if (patient.allergies.isNotBlank() || patient.chronicDiseases.isNotBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (patient.allergies.isNotBlank()) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MedicalDangerBg
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = MedicalDanger,
                                    modifier = Modifier.size(12.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "${if (isArabic) "حساسية: " else "Allergy: "}${patient.allergies}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MedicalDanger,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1
                                )
                            }
                        }
                    }
                    if (patient.chronicDiseases.isNotBlank()) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MedicalWarningBg
                        ) {
                            Text(
                                text = patient.chronicDiseases,
                                style = MaterialTheme.typography.labelSmall,
                                color = MedicalWarning,
                                fontWeight = FontWeight.Medium,
                                maxLines = 1,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AddPatientDialog(
    isArabic: Boolean,
    onDismiss: () -> Unit,
    onSave: (
        fullName: String,
        nationalId: String,
        phone: String,
        gender: String,
        dob: String,
        bloodType: String,
        allergies: String,
        chronic: String,
        ecName: String,
        ecPhone: String,
        insProvider: String,
        insNumber: String
    ) -> Unit
) {
    var fullName by remember { mutableStateOf("") }
    var nationalId by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("Male") }
    var dob by remember { mutableStateOf("1990-01-01") }
    var bloodType by remember { mutableStateOf("O+") }
    var allergies by remember { mutableStateOf("") }
    var chronic by remember { mutableStateOf("") }
    var ecName by remember { mutableStateOf("") }
    var ecPhone by remember { mutableStateOf("") }
    var insProvider by remember { mutableStateOf("") }
    var insNumber by remember { mutableStateOf("") }

    val bloodOptions = listOf("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")

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
                        text = if (isArabic) "تسجيل ملف مريض جديد" else "Register New Patient Record",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                item {
                    OutlinedTextField(
                        value = fullName,
                        onValueChange = { fullName = it },
                        label = { Text(if (isArabic) "الاسم الثلاثي *" else "Full Name *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = nationalId,
                            onValueChange = { nationalId = it },
                            label = { Text(if (isArabic) "الرقم الوطني" else "National ID") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = phone,
                            onValueChange = { phone = it },
                            label = { Text(if (isArabic) "الهاتف *" else "Phone *") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                }

                item {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isArabic) "الجنس:" else "Gender:",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        FilterChip(
                            selected = gender == "Male",
                            onClick = { gender = "Male" },
                            label = { Text(if (isArabic) "ذكر" else "Male") }
                        )
                        FilterChip(
                            selected = gender == "Female",
                            onClick = { gender = "Female" },
                            label = { Text(if (isArabic) "أنثى" else "Female") }
                        )
                    }
                }

                item {
                    Text(
                        text = if (isArabic) "فصيلة الدم:" else "Blood Type:",
                        style = MaterialTheme.typography.labelMedium
                    )
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(bloodOptions) { bt ->
                            FilterChip(
                                selected = bloodType == bt,
                                onClick = { bloodType = bt },
                                label = { Text(bt) }
                            )
                        }
                    }
                }

                item {
                    OutlinedTextField(
                        value = dob,
                        onValueChange = { dob = it },
                        label = { Text(if (isArabic) "تاريخ الميلاد (YYYY-MM-DD)" else "Date of Birth") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }

                item {
                    OutlinedTextField(
                        value = allergies,
                        onValueChange = { allergies = it },
                        label = { Text(if (isArabic) "الحساسية الدوائية / الغذائية" else "Known Allergies") },
                        placeholder = { Text("e.g. Penicillin, Aspirin") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    OutlinedTextField(
                        value = chronic,
                        onValueChange = { chronic = it },
                        label = { Text(if (isArabic) "الأمراض المزمنة" else "Chronic Diseases") },
                        placeholder = { Text("e.g. Diabetes, Hypertension") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = ecName,
                            onValueChange = { ecName = it },
                            label = { Text(if (isArabic) "اسم قريب للطوارئ" else "Emergency Contact") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = ecPhone,
                            onValueChange = { ecPhone = it },
                            label = { Text(if (isArabic) "هاتف الطوارئ" else "Emergency Phone") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = insProvider,
                            onValueChange = { insProvider = it },
                            label = { Text(if (isArabic) "شركة التأمين" else "Insurance Provider") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = insNumber,
                            onValueChange = { insNumber = it },
                            label = { Text(if (isArabic) "رقم البطاقة" else "Policy / Card #") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                }

                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(onClick = onDismiss) {
                            Text(if (isArabic) "إلغاء" else "Cancel")
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                if (fullName.isNotBlank() && phone.isNotBlank()) {
                                    onSave(
                                        fullName, nationalId, phone, gender, dob, bloodType,
                                        allergies, chronic, ecName, ecPhone, insProvider, insNumber
                                    )
                                }
                            },
                            enabled = fullName.isNotBlank() && phone.isNotBlank()
                        ) {
                            Text(if (isArabic) "حفظ وتسجيل" else "Save & Open")
                        }
                    }
                }
            }
        }
    }
}
