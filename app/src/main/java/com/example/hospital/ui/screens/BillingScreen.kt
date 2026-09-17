package com.example.hospital.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.example.hospital.data.model.Invoice
import com.example.hospital.ui.components.EmptyStateCard
import com.example.hospital.ui.components.StatCard
import com.example.hospital.ui.components.StatusBadge
import com.example.hospital.ui.theme.*
import com.example.hospital.ui.viewmodel.HospitalViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillingScreen(
    viewModel: HospitalViewModel,
    modifier: Modifier = Modifier
) {
    val isArabic by viewModel.isArabic.collectAsState()
    val invoices by viewModel.allInvoices.collectAsState()
    val totalBilled by viewModel.totalBilled.collectAsState()
    val totalPaid by viewModel.totalPaid.collectAsState()
    val unpaidCount by viewModel.unpaidCount.collectAsState()
    val patients by viewModel.allPatients.collectAsState()

    var statusFilter by remember { mutableStateOf<String?>(null) }
    var showCreateInvoiceDialog by remember { mutableStateOf(false) }
    var selectedInvoiceForPayment by remember { mutableStateOf<Invoice?>(null) }

    val filteredInvoices = remember(invoices, statusFilter) {
        if (statusFilter == null) invoices else invoices.filter { it.status.equals(statusFilter, ignoreCase = true) }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateInvoiceDialog = true },
                containerColor = HospitalPrimary,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.testTag("create_invoice_fab")
            ) {
                Icon(Icons.Default.PostAdd, contentDescription = "Create Invoice")
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            contentPadding = PaddingValues(top = 12.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Financial KPI Cards
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        title = if (isArabic) "إجمالي التحصيل" else "Total Collected",
                        value = "$${String.format("%.1f", totalPaid)}",
                        subtitle = if (isArabic) "المقبوضات الفعلية" else "Paid Invoices",
                        icon = Icons.Default.AccountBalanceWallet,
                        accentColor = MedicalSuccess,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = if (isArabic) "المتبقي / غير مسدد" else "Outstanding",
                        value = "$${String.format("%.1f", (totalBilled - totalPaid).coerceAtLeast(0.0))}",
                        subtitle = if (isArabic) "$unpaidCount فواتير معلقة" else "$unpaidCount Unpaid Bills",
                        icon = Icons.Default.PendingActions,
                        accentColor = if (unpaidCount > 0) MedicalWarning else MedicalSuccess,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Filter Chips: All, Paid, Partial, Unpaid
            item {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    item {
                        FilterChip(
                            selected = statusFilter == null,
                            onClick = { statusFilter = null },
                            label = { Text(if (isArabic) "الكل (${invoices.size})" else "All (${invoices.size})") }
                        )
                    }
                    listOf("Paid", "Partial", "Unpaid").forEach { st ->
                        item {
                            FilterChip(
                                selected = statusFilter == st,
                                onClick = { statusFilter = if (statusFilter == st) null else st },
                                label = { Text(st) }
                            )
                        }
                    }
                }
            }

            if (filteredInvoices.isEmpty()) {
                item {
                    EmptyStateCard(
                        icon = Icons.Default.ReceiptLong,
                        title = if (isArabic) "لا توجد فواتير" else "No Invoices Found",
                        description = if (isArabic) "لم يتم العثور على فواتير بهذا التصنيف." else "No invoices match the selected payment status filter.",
                        actionButtonText = if (isArabic) "إنشاء فاتورة جديدة" else "Issue Invoice",
                        onActionClick = { showCreateInvoiceDialog = true }
                    )
                }
            } else {
                items(filteredInvoices, key = { it.id }) { inv ->
                    InvoiceCard(
                        invoice = inv,
                        isArabic = isArabic,
                        onCollectPayment = { selectedInvoiceForPayment = inv }
                    )
                }
            }
        }
    }

    selectedInvoiceForPayment?.let { inv ->
        RecordPaymentDialog(
            invoice = inv,
            isArabic = isArabic,
            onDismiss = { selectedInvoiceForPayment = null },
            onConfirm = { amount ->
                viewModel.recordInvoicePayment(inv, amount)
                selectedInvoiceForPayment = null
            }
        )
    }

    if (showCreateInvoiceDialog) {
        CreateInvoiceDialog(
            isArabic = isArabic,
            patients = patients,
            onDismiss = { showCreateInvoiceDialog = false },
            onSave = { pId, pName, desc, total, discount, paid, method ->
                viewModel.createInvoice(pId, pName, desc, total, discount, paid, method)
                showCreateInvoiceDialog = false
            }
        )
    }
}

@Composable
fun InvoiceCard(
    invoice: Invoice,
    isArabic: Boolean,
    onCollectPayment: () -> Unit,
    modifier: Modifier = Modifier
) {
    val net = invoice.totalAmount - invoice.discountAmount
    val remaining = (net - invoice.paidAmount).coerceAtLeast(0.0)

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
                Column {
                    Text(
                        text = invoice.invoiceNumber,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = HospitalPrimary
                    )
                    Text(
                        text = "${invoice.patientName} • ${invoice.date}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                StatusBadge(status = invoice.status)
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = invoice.servicesDescription,
                style = MaterialTheme.typography.bodyMedium
            )

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "${if (isArabic) "الإجمالي: " else "Total: "}$${String.format("%.2f", net)}",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${if (isArabic) "المتبقي: " else "Due: "}$${String.format("%.2f", remaining)} (${invoice.paymentMethod})",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (remaining > 0) MedicalWarning else MedicalSuccess,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                if (invoice.status != "Paid") {
                    Button(
                        onClick = onCollectPayment,
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Default.Payment, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isArabic) "تحصيل دفعة" else "Pay Now")
                    }
                }
            }
        }
    }
}

@Composable
fun RecordPaymentDialog(
    invoice: Invoice,
    isArabic: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (amount: Double) -> Unit
) {
    val net = invoice.totalAmount - invoice.discountAmount
    val due = (net - invoice.paidAmount).coerceAtLeast(0.0)
    var amountStr by remember { mutableStateOf(String.format("%.2f", due)) }

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
                    text = if (isArabic) "تسجيل دفعة للفاتورة" else "Collect Payment",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                Text("${invoice.invoiceNumber} • ${invoice.patientName}")
                Text(
                    text = "${if (isArabic) "المبلغ المستحق: " else "Amount Due: "}$${String.format("%.2f", due)}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MedicalWarning
                )

                OutlinedTextField(
                    value = amountStr,
                    onValueChange = { amountStr = it },
                    label = { Text(if (isArabic) "المبلغ المدفوع ($)" else "Payment Amount ($)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
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
                            val amt = amountStr.toDoubleOrNull() ?: 0.0
                            if (amt > 0.0) onConfirm(amt)
                        },
                        enabled = (amountStr.toDoubleOrNull() ?: 0.0) > 0.0
                    ) {
                        Text(if (isArabic) "تأكيد القبض" else "Confirm")
                    }
                }
            }
        }
    }
}

@Composable
fun CreateInvoiceDialog(
    isArabic: Boolean,
    patients: List<com.example.hospital.data.model.Patient>,
    onDismiss: () -> Unit,
    onSave: (pId: Long, pName: String, desc: String, total: Double, discount: Double, paid: Double, method: String) -> Unit
) {
    var selectedPatient by remember { mutableStateOf(patients.firstOrNull()) }
    var description by remember { mutableStateOf("General Consultation & Clinical Diagnostics") }
    var totalStr by remember { mutableStateOf("100.0") }
    var discountStr by remember { mutableStateOf("0.0") }
    var paidStr by remember { mutableStateOf("100.0") }
    var paymentMethod by remember { mutableStateOf("Cash") }

    val methods = listOf("Cash", "Card", "Insurance")

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
                        text = if (isArabic) "إصدار فاتورة جديدة" else "Issue New Clinical Invoice",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                item {
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
                }

                item {
                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text(if (isArabic) "بيان الخدمات والأدوية *" else "Services Description *") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = totalStr,
                            onValueChange = { totalStr = it },
                            label = { Text(if (isArabic) "الإجمالي ($)" else "Total ($)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = discountStr,
                            onValueChange = { discountStr = it },
                            label = { Text(if (isArabic) "الخصم ($)" else "Discount ($)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = paidStr,
                            onValueChange = { paidStr = it },
                            label = { Text(if (isArabic) "المسدد ($)" else "Paid ($)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                }

                item {
                    Text(if (isArabic) "طريقة السداد:" else "Payment Method:")
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(methods) { m ->
                            FilterChip(
                                selected = paymentMethod == m,
                                onClick = { paymentMethod = m },
                                label = { Text(m) }
                            )
                        }
                    }
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
                                val tot = totalStr.toDoubleOrNull() ?: 0.0
                                val disc = discountStr.toDoubleOrNull() ?: 0.0
                                val pd = paidStr.toDoubleOrNull() ?: 0.0
                                if (p != null && tot > 0.0) {
                                    onSave(p.id, p.fullName, description, tot, disc, pd, paymentMethod)
                                }
                            },
                            enabled = selectedPatient != null && (totalStr.toDoubleOrNull() ?: 0.0) > 0.0
                        ) {
                            Text(if (isArabic) "إصدار وحفظ" else "Save Invoice")
                        }
                    }
                }
            }
        }
    }
}
