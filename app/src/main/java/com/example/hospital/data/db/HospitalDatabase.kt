package com.example.hospital.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.hospital.data.dao.HospitalDao
import com.example.hospital.data.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate

@Database(
    entities = [
        Patient::class,
        Appointment::class,
        MedicalRecord::class,
        Invoice::class,
        Medication::class,
        Department::class,
        Doctor::class,
        QueueTicket::class
    ],
    version = 1,
    exportSchema = false
)
abstract class HospitalDatabase : RoomDatabase() {
    abstract fun hospitalDao(): HospitalDao

    companion object {
        @Volatile
        private var INSTANCE: HospitalDatabase? = null

        fun getDatabase(context: Context, scope: CoroutineScope): HospitalDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    HospitalDatabase::class.java,
                    "hospital_system_database"
                )
                    .addCallback(HospitalDatabaseCallback(scope))
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }

        private class HospitalDatabaseCallback(
            private val scope: CoroutineScope
        ) : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                INSTANCE?.let { database ->
                    scope.launch(Dispatchers.IO) {
                        seedDemoData(database.hospitalDao())
                    }
                }
            }
        }

        suspend fun seedDemoData(dao: HospitalDao) {
            dao.clearPatients()
            dao.clearAppointments()
            dao.clearMedicalRecords()
            dao.clearInvoices()
            dao.clearMedications()
            dao.clearDepartments()
            dao.clearDoctors()
            dao.clearQueueTickets()

            // Departments
            val depts = listOf(
                Department(1, "Emergency Medicine", "قسم الطوارئ والإسعاف", "EMERG", "Dr. Zaid Al-Bavarian", 24, "101"),
                Department(2, "Cardiology", "قسم أمراض القلب والأوعية", "CARD", "Dr. Tariq Mansoor", 30, "102"),
                Department(3, "Pediatrics", "قسم طب الأطفال وحديثي الولادة", "PED", "Dr. Sarah Al-Ahmad", 20, "103"),
                Department(4, "General Surgery", "قسم الجراحة العامة", "SURG", "Dr. Omar Khaled", 35, "104"),
                Department(5, "Internal Medicine", "قسم الأمراض الباطنية", "INT", "Dr. Fatima Al-Zahra", 40, "105"),
                Department(6, "Orthopedics", "قسم جراحة العظام والمفاصل", "ORTHO", "Dr. Youssef Nabil", 25, "106")
            )
            dao.insertDepartments(depts)

            // Doctors
            val doctors = listOf(
                Doctor(1, "Dr. Zaid Al-Bavarian", "Consultant Emergency & Trauma", "Emergency Medicine", "+964 770 123 4567", 50.0, "Sun, Mon, Tue, Wed, Thu"),
                Doctor(2, "Dr. Tariq Mansoor", "Consultant Cardiologist", "Cardiology", "+964 771 234 5678", 75.0, "Sun, Tue, Thu"),
                Doctor(3, "Dr. Sarah Al-Ahmad", "Pediatric Specialist", "Pediatrics", "+964 772 345 6789", 45.0, "Mon, Wed, Fri"),
                Doctor(4, "Dr. Omar Khaled", "Senior General Surgeon", "General Surgery", "+964 773 456 7890", 90.0, "Sun, Mon, Wed"),
                Doctor(5, "Dr. Fatima Al-Zahra", "Internal Medicine Consultant", "Internal Medicine", "+964 774 567 8901", 60.0, "Sun, Mon, Tue, Thu")
            )
            dao.insertDoctors(doctors)

            // Patients
            val patients = listOf(
                Patient(
                    id = 1,
                    fileNumber = "MRN-1001",
                    fullName = "Ahmed Hassan Al-Basri",
                    nationalId = "1988234501",
                    phone = "+964 770 555 1234",
                    gender = "Male",
                    dateOfBirth = "1988-04-12",
                    bloodType = "O+",
                    allergies = "Penicillin, Sulfa",
                    chronicDiseases = "Type 2 Diabetes, Hypertension",
                    emergencyContactName = "Muna Hassan (Wife)",
                    emergencyContactPhone = "+964 770 555 9988",
                    insuranceProvider = "National Health Care Co.",
                    insuranceNumber = "NHC-88210"
                ),
                Patient(
                    id = 2,
                    fileNumber = "MRN-1002",
                    fullName = "Noor Kareem Al-Saadi",
                    nationalId = "1994567802",
                    phone = "+964 771 444 8765",
                    gender = "Female",
                    dateOfBirth = "1994-08-23",
                    bloodType = "A+",
                    allergies = "None Known",
                    chronicDiseases = "Mild Asthma",
                    emergencyContactName = "Kareem Al-Saadi (Father)",
                    emergencyContactPhone = "+964 771 444 1122",
                    insuranceProvider = "Al-Mashreq Insurance",
                    insuranceNumber = "MSH-44912"
                ),
                Patient(
                    id = 3,
                    fileNumber = "MRN-1003",
                    fullName = "Mustafa Jasim Al-Husseini",
                    nationalId = "1975987603",
                    phone = "+964 772 333 4455",
                    gender = "Male",
                    dateOfBirth = "1975-11-05",
                    bloodType = "B+",
                    allergies = "Aspirin",
                    chronicDiseases = "Coronary Artery Disease",
                    emergencyContactName = "Ali Mustafa (Son)",
                    emergencyContactPhone = "+964 772 333 9900",
                    insuranceProvider = "Direct Hospital Corporate",
                    insuranceNumber = "DHC-75103"
                ),
                Patient(
                    id = 4,
                    fileNumber = "MRN-1004",
                    fullName = "Maryam Haidar Al-Dulaimi",
                    nationalId = "2001123404",
                    phone = "+964 773 222 6677",
                    gender = "Female",
                    dateOfBirth = "2001-02-18",
                    bloodType = "AB+",
                    allergies = "Iodine Contrast",
                    chronicDiseases = "None",
                    emergencyContactName = "Haidar Al-Dulaimi (Father)",
                    emergencyContactPhone = "+964 773 222 1100",
                    insuranceProvider = "Self Pay",
                    insuranceNumber = "N/A"
                ),
                Patient(
                    id = 5,
                    fileNumber = "MRN-1005",
                    fullName = "Zainab Ali Al-Khafaji",
                    nationalId = "1999876505",
                    phone = "+964 774 111 8899",
                    gender = "Female",
                    dateOfBirth = "1999-07-30",
                    bloodType = "O-",
                    allergies = "Latex",
                    chronicDiseases = "Hypothyroidism",
                    emergencyContactName = "Hussain Al-Khafaji (Husband)",
                    emergencyContactPhone = "+964 774 111 5544",
                    insuranceProvider = "Gulf Care Network",
                    insuranceNumber = "GCN-99014"
                )
            )
            dao.insertPatients(patients)

            val today = LocalDate.now().toString()
            val tomorrow = LocalDate.now().plusDays(1).toString()

            // Appointments
            val appointments = listOf(
                Appointment(1, 1, "Ahmed Hassan Al-Basri", "Dr. Tariq Mansoor", "Cardiology", today, "09:30 AM", "Waiting", "Quarterly cardiac review & ECG", "Patient arrived on time"),
                Appointment(2, 2, "Noor Kareem Al-Saadi", "Dr. Fatima Al-Zahra", "Internal Medicine", today, "10:15 AM", "In Progress", "Chronic fatigue and blood work review", "Currently in room 105"),
                Appointment(3, 3, "Mustafa Jasim Al-Husseini", "Dr. Tariq Mansoor", "Cardiology", today, "11:00 AM", "Scheduled", "Post-angioplasty follow-up", "Prepare previous angiogram files"),
                Appointment(4, 4, "Maryam Haidar Al-Dulaimi", "Dr. Sarah Al-Ahmad", "Pediatrics", tomorrow, "09:00 AM", "Scheduled", "Vaccination consultation & health check", "Bring immunisation book"),
                Appointment(5, 5, "Zainab Ali Al-Khafaji", "Dr. Omar Khaled", "General Surgery", tomorrow, "11:30 AM", "Scheduled", "Pre-operative evaluation", "Fasting required")
            )
            dao.insertAppointments(appointments)

            // Medical Records
            val records = listOf(
                MedicalRecord(
                    id = 1,
                    patientId = 1,
                    doctorName = "Dr. Tariq Mansoor",
                    visitDate = "2024-08-15",
                    chiefComplaint = "Mild chest discomfort upon exertion",
                    diagnosis = "Essential Hypertension, Stable Angina Stage 1",
                    prescription = "1. Bisoprolol 5mg once daily\n2. Atorvastatin 20mg at bedtime\n3. Metformin 500mg twice daily with meals",
                    bloodPressure = "142/88 mmHg",
                    temperature = "36.8 °C",
                    pulse = "74 bpm",
                    notes = "ECG reveals normal sinus rhythm. Follow-up scheduled in 3 months. Advised low-sodium diet and daily walking."
                ),
                MedicalRecord(
                    id = 2,
                    patientId = 2,
                    doctorName = "Dr. Fatima Al-Zahra",
                    visitDate = "2024-09-02",
                    chiefComplaint = "Persistent shortness of breath and wheezing at night",
                    diagnosis = "Acute Bronchospasm secondary to seasonal allergy",
                    prescription = "1. Salbutamol Inhaler 100mcg (2 puffs PRN)\n2. Fluticasone inhaler twice daily\n3. Cetirizine 10mg nightly",
                    bloodPressure = "118/76 mmHg",
                    temperature = "37.1 °C",
                    pulse = "82 bpm",
                    notes = "Chest auscultation bilateral wheezing. Oxygen saturation 97% on room air. Avoid cold drinks and dust."
                ),
                MedicalRecord(
                    id = 3,
                    patientId = 3,
                    doctorName = "Dr. Zaid Al-Bavarian",
                    visitDate = "2024-07-20",
                    chiefComplaint = "Sudden dizziness and palpitations",
                    diagnosis = "Supraventricular Tachycardia episode, resolved",
                    prescription = "1. Diltiazem 60mg TDS\n2. Aspirin 81mg OD with food",
                    bloodPressure = "135/85 mmHg",
                    temperature = "36.6 °C",
                    pulse = "110 bpm initial -> 76 bpm post treatment",
                    notes = "Admitted to ER observation for 4 hours. Electrolytes normal. Discharged in stable condition."
                )
            )
            dao.insertMedicalRecords(records)

            // Invoices
            val invoices = listOf(
                Invoice(1, "INV-2024-001", 1, "Ahmed Hassan Al-Basri", today, "Cardiology Consultation + Resting ECG + Blood Sugar Panel", 120.0, 10.0, 110.0, "Paid", "Card"),
                Invoice(2, "INV-2024-002", 2, "Noor Kareem Al-Saadi", today, "Internal Medicine Consultation + Complete Blood Count + Spirometry", 95.0, 0.0, 0.0, "Unpaid", "Cash"),
                Invoice(3, "INV-2024-003", 3, "Mustafa Jasim Al-Husseini", "2024-09-10", "Emergency Room Bed Fee + IV Infusion + Cardiac Monitoring", 220.0, 20.0, 100.0, "Partial", "Insurance"),
                Invoice(4, "INV-2024-004", 4, "Maryam Haidar Al-Dulaimi", "2024-09-12", "Pediatric Wellness Exam + Growth Assessment", 50.0, 0.0, 50.0, "Paid", "Cash")
            )
            dao.insertInvoices(invoices)

            // Medications
            val meds = listOf(
                Medication(1, "Amoxicillin / Clavulanic Acid 1g", "Augmentin", "Antibiotic", 140, "Box (14 tabs)", 8.50, 20, "2026-11-30"),
                Medication(2, "Paracetamol 500mg", "Panadol Advance", "Analgesic", 450, "Box (24 tabs)", 2.00, 50, "2027-05-15"),
                Medication(3, "Bisoprolol Fumarate 5mg", "Concor", "Cardiovascular", 85, "Box (30 tabs)", 12.00, 15, "2026-08-20"),
                Medication(4, "Atorvastatin Calcium 20mg", "Lipitor", "Cardiovascular", 60, "Box (30 tabs)", 18.50, 15, "2026-12-10"),
                Medication(5, "Metformin HCl 500mg", "Glucophage", "Antidiabetic", 210, "Box (50 tabs)", 6.00, 30, "2027-02-28"),
                Medication(6, "Salbutamol 100mcg Inhaler", "Ventolin", "Respiratory", 8, "Canister (200 doses)", 7.25, 12, "2026-10-15"), // LOW STOCK
                Medication(7, "Omeprazole 20mg Capsules", "Losec", "Gastrointestinal", 120, "Box (28 caps)", 9.00, 25, "2026-09-30"),
                Medication(8, "Ceftriaxone 1g Vial", "Rocephin", "Injectable Antibiotic", 5, "Vial", 14.00, 15, "2026-07-31"), // LOW STOCK
                Medication(9, "Ibuprofen 400mg", "Brufen", "NSAID Painkiller", 180, "Box (30 tabs)", 4.50, 30, "2027-03-20")
            )
            dao.insertMedications(meds)

            // Live Queue Tickets
            val queue = listOf(
                QueueTicket(1, "EM-101", 1, "Ahmed Hassan Al-Basri", "Emergency Medicine", "Dr. Zaid Al-Bavarian", "Serving"),
                QueueTicket(2, "CARD-102", 3, "Mustafa Jasim Al-Husseini", "Cardiology", "Dr. Tariq Mansoor", "Waiting"),
                QueueTicket(3, "INT-103", 2, "Noor Kareem Al-Saadi", "Internal Medicine", "Dr. Fatima Al-Zahra", "Waiting"),
                QueueTicket(4, "PED-104", 4, "Maryam Haidar Al-Dulaimi", "Pediatrics", "Dr. Sarah Al-Ahmad", "Waiting")
            )
            dao.insertQueueTickets(queue)
        }
    }
}
