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
import com.example.hospital.data.model.Medication
import com.example.hospital.ui.components.EmptyStateCard
import com.example.hospital.ui.components.SearchInputBar
import com.example.hospital.ui.theme.*
import com.example.hospital.ui.viewmodel.HospitalViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PharmacyScreen(
    viewModel: HospitalViewModel,
    modifier: Modifier = Modifier
) {
    val isArabic by viewModel.isArabic.collectAsState()
    val medications by viewModel.filteredMedications.collectAsState()
    val lowStockMeds by viewModel.lowStockMedications.collectAsState()
    val searchQuery by viewModel.medSearchQuery.collectAsState()
    val selectedCat by viewModel.selectedMedCategory.collectAsState()

    var showAddMedDialog by remember { mutableStateOf(false) }
    var selectedMedForDispense by remember { mutableStateOf<Medication?>(null) }

    val categories = listOf("Antibiotic", "Analgesic", "Cardiovascular", "Antidiabetic", "Respiratory", "Gastrointestinal", "NSAID Painkiller")

    Scaffold(
        modifier = modifier.fillMaxSize(),
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddMedDialog = true },
                containerColor = MedicalSuccess,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.testTag("add_medication_fab")
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Medicine")
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

            // Low Stock Alert Banner (if any)
            if (lowStockMeds.isNotEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = MedicalDangerBg)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = null,
                            tint = MedicalDanger,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = if (isArabic) "تنبيه نقص في مخزون الصيدلية!" else "Pharmacy Low Stock Alert!",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = MedicalDanger
                            )
                            Text(
                                text = if (isArabic) "يوجد ${lowStockMeds.size} أصناف أوشكت على النفاد وتحتاج إعادة توريد." else "${lowStockMeds.size} medicines are below minimum safety threshold.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MedicalDanger
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Search Bar
            SearchInputBar(
                query = searchQuery,
                onQueryChange = { viewModel.medSearchQuery.value = it },
                placeholder = if (isArabic) "بحث عن دواء، الاسم العلمي..." else "Search medication by trade or generic name..."
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Category Chips
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                item {
                    FilterChip(
                        selected = selectedCat == null,
                        onClick = { viewModel.selectedMedCategory.value = null },
                        label = { Text(if (isArabic) "الكل" else "All") }
                    )
                }
                items(categories) { cat ->
                    FilterChip(
                        selected = selectedCat == cat,
                        onClick = {
                            viewModel.selectedMedCategory.value =
                                if (selectedCat == cat) null else cat
                        },
                        label = { Text(cat) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (medications.isEmpty()) {
                EmptyStateCard(
                    icon = Icons.Default.Medication,
                    title = if (isArabic) "لا توجد أدوية مطابقة" else "No Medications Found",
                    description = if (isArabic) "تأكد من كتابة الاسم بشكل صحيح أو أضف صنفًا جديدًا." else "No medicine matches your search or selected filter.",
                    actionButtonText = if (isArabic) "إضافة صنف دواء" else "Add New Drug",
                    onActionClick = { showAddMedDialog = true }
                )
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 96.dp)
                ) {
                    items(medications, key = { it.id }) { med ->
                        MedicationItemCard(
                            med = med,
                            isArabic = isArabic,
                            onDispense = { selectedMedForDispense = med }
                        )
                    }
                }
            }
        }
    }

    selectedMedForDispense?.let { med ->
        DispenseMedicationDialog(
            med = med,
            isArabic = isArabic,
            onDismiss = { selectedMedForDispense = null },
            onConfirm = { qty ->
                viewModel.dispenseMedication(med.id, qty) { success ->
                    selectedMedForDispense = null
                }
            }
        )
    }

    if (showAddMedDialog) {
        AddMedicationDialog(
            isArabic = isArabic,
            categories = categories,
            onDismiss = { showAddMedDialog = false },
            onSave = { name, sciName, cat, qty, unit, price, minAlert, exp ->
                viewModel.addMedication(name, sciName, cat, qty, unit, price, minAlert, exp)
                showAddMedDialog = false
            }
        )
    }
}

@Composable
fun MedicationItemCard(
    med: Medication,
    isArabic: Boolean,
    onDispense: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isLowStock = med.stockQuantity <= med.minAlertQuantity

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
                        text = med.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${med.scientificName} • ${med.category}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (isLowStock) MedicalDangerBg else MedicalSuccessBg
                ) {
                    Text(
                        text = if (isLowStock) (if (isArabic) "مخزون حرج: ${med.stockQuantity}" else "Low: ${med.stockQuantity}") else "${med.stockQuantity} ${med.unit}",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (isLowStock) MedicalDanger else MedicalSuccess,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Stock Progress Bar
            val progress = (med.stockQuantity.toFloat() / (med.minAlertQuantity * 3).toFloat()).coerceIn(0f, 1f)
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = if (isLowStock) MedicalDanger else MedicalSuccess,
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "${if (isArabic) "السعر: " else "Price: "}$${String.format("%.2f", med.unitPrice)}",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = HospitalPrimary
                    )
                    Text(
                        text = "${if (isArabic) "الصلاحية: " else "Exp: "}${med.expiryDate}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Button(
                    onClick = onDispense,
                    enabled = med.stockQuantity > 0,
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.LocalPharmacy, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (isArabic) "صرف دواء" else "Dispense")
                }
            }
        }
    }
}

@Composable
fun DispenseMedicationDialog(
    med: Medication,
    isArabic: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (quantity: Int) -> Unit
) {
    var quantity by remember { mutableStateOf(1) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth().padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = if (isArabic) "صرف دواء من الصيدلية" else "Dispense Prescription Medication",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = med.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = HospitalPrimary
                )
                Text(
                    text = "${if (isArabic) "المخزون المتوفر: " else "Available Stock: "}${med.stockQuantity} ${med.unit}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    IconButton(
                        onClick = { if (quantity > 1) quantity-- },
                        enabled = quantity > 1
                    ) {
                        Icon(Icons.Default.RemoveCircleOutline, contentDescription = "Decrease")
                    }
                    Text(
                        text = quantity.toString(),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )
                    IconButton(
                        onClick = { if (quantity < med.stockQuantity) quantity++ },
                        enabled = quantity < med.stockQuantity
                    ) {
                        Icon(Icons.Default.AddCircleOutline, contentDescription = "Increase")
                    }
                }

                Text(
                    text = "${if (isArabic) "الإجمالي: " else "Total Cost: "}$${String.format("%.2f", quantity * med.unitPrice)}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = HospitalPrimary
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
                        onClick = { onConfirm(quantity) },
                        enabled = quantity in 1..med.stockQuantity
                    ) {
                        Text(if (isArabic) "تأكيد الصرف" else "Confirm Dispense")
                    }
                }
            }
        }
    }
}

@Composable
fun AddMedicationDialog(
    isArabic: Boolean,
    categories: List<String>,
    onDismiss: () -> Unit,
    onSave: (name: String, sciName: String, cat: String, qty: Int, unit: String, price: Double, minAlert: Int, exp: String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var sciName by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(categories.firstOrNull() ?: "General") }
    var qtyStr by remember { mutableStateOf("100") }
    var unit by remember { mutableStateOf("Box (30 tabs)") }
    var priceStr by remember { mutableStateOf("10.0") }
    var minAlertStr by remember { mutableStateOf("15") }
    var expDate by remember { mutableStateOf("2026-12-31") }

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
                        text = if (isArabic) "إضافة دواء جديد للمخزون" else "Add New Medication",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                item {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text(if (isArabic) "اسم الدواء التجاري *" else "Trade Name *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }

                item {
                    OutlinedTextField(
                        value = sciName,
                        onValueChange = { sciName = it },
                        label = { Text(if (isArabic) "الاسم العلمي / المادة الفعالة" else "Scientific Name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }

                item {
                    Text(if (isArabic) "الفئة العلاجية:" else "Category:")
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(categories) { cat ->
                            FilterChip(
                                selected = category == cat,
                                onClick = { category = cat },
                                label = { Text(cat) }
                            )
                        }
                    }
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = qtyStr,
                            onValueChange = { qtyStr = it },
                            label = { Text(if (isArabic) "الكمية" else "Qty") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = unit,
                            onValueChange = { unit = it },
                            label = { Text(if (isArabic) "الوحدة" else "Unit") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = priceStr,
                            onValueChange = { priceStr = it },
                            label = { Text(if (isArabic) "سعر البيع ($)" else "Price ($)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = minAlertStr,
                            onValueChange = { minAlertStr = it },
                            label = { Text(if (isArabic) "حد التنبيه" else "Alert Threshold") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                }

                item {
                    OutlinedTextField(
                        value = expDate,
                        onValueChange = { expDate = it },
                        label = { Text(if (isArabic) "تاريخ الصلاحية (YYYY-MM-DD)" else "Expiry Date") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
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
                                val q = qtyStr.toIntOrNull() ?: 0
                                val p = priceStr.toDoubleOrNull() ?: 0.0
                                val m = minAlertStr.toIntOrNull() ?: 10
                                if (name.isNotBlank()) {
                                    onSave(name, sciName, category, q, unit, p, m, expDate)
                                }
                            },
                            enabled = name.isNotBlank()
                        ) {
                            Text(if (isArabic) "إضافة للدليل" else "Add to Inventory")
                        }
                    }
                }
            }
        }
    }
}
