# Speech Therapy Clinic Desktop App

This is a lightweight Electron app for managing patients in a speech therapy
clinic. It stores each patient in its own folder under the app data directory
and provides built-in analytics plus messaging integration via a configurable
HTTP API.

## Features
- Create, edit, and delete patients
- Per-patient analysis and overall clinic analysis
- MySQL-backed patient storage
- Attachments (images/PDFs) per patient
- Multi-clinic registration with admin login
- SMS and WhatsApp messaging through a configurable API endpoint

## Setup
1. Install dependencies:
   - `npm install`
2. Start the app:
   - `npm start`

## Building the Windows installer (desktop icon)
To create an `.exe` installer that adds a desktop shortcut:

1. Install dependencies (if not already): `npm install`
2. Build: `npm run build`
3. The installer is created in the `dist` folder, e.g.  
   `dist/Speech Therapy Clinic Setup 0.1.0.exe`
4. Run the installer and choose installation directory; it will create:
   - A **desktop shortcut** (Speech Therapy Clinic)
   - A **Start Menu** shortcut
5. After install, to use MySQL put a `.env` file in the app data folder  
   (e.g. `%APPDATA%\Speech Therapy Clinic\.env`) with your DB settings,  
   or run the app once from the project folder so it can read `.env` from there.

## Database (MySQL)
Patient data is stored in MySQL. Configure the connection using a `.env` file
in the project root (same folder as `main.js`):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=clinic_user
DB_PASSWORD=your_password
DB_NAME=clinic_db
```

Create the database and user in MySQL (example):
```
CREATE DATABASE clinic_db;
CREATE USER 'clinic_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON clinic_db.* TO 'clinic_user'@'localhost';
FLUSH PRIVILEGES;
```

On first run, existing JSON patient profiles in `clinic-data/patients/*/profile.json`
are imported into MySQL if the `patients` table is empty.

## Clinic Registration
On first run, the app shows a registration screen where you create:
- A clinic profile (name, phone, email, address)
- An admin account (name, email, phone, password)

After registration, you can log in to select the active clinic.

## Data Storage
Patient data is stored in MySQL. File storage is used for:
- `app.getPath("userData")/clinic-data/patients/<patient-id>/attachments/`
- `app.getPath("userData")/clinic-data/messages.log`

Attachments (images/PDFs) are stored as BLOBs in MySQL and also copied into the
patient attachments folder on disk.

## Messaging API
The app sends a POST request to the configured Message API URL with JSON like:

```json
{
  "channel": "sms",
  "to": "+15551234567",
  "from": "+15550001111",
  "message": "Your appointment is tomorrow at 10:00 AM.",
  "patient": {
    "id": "patient-abc123",
    "fullName": "Jane Doe"
  }
}
```

## Gateway (Twilio-ready)
This repo includes a simple local gateway that accepts the app payload and
forwards it to Twilio for SMS/WhatsApp.

1. Copy the example env file and fill in your Twilio credentials:
   - `gateway/.env.example` -> `gateway/.env`
2. Run the gateway:
   - `npm run gateway`
3. In the app Settings, set:
   - Message API URL: `http://localhost:5050/send`
   - Message API Key: same as `GATEWAY_API_KEY` (if you set one)

Environment variables used by the gateway:
- `GATEWAY_PORT` (default: 5050)
- `GATEWAY_API_KEY` (optional, secures the gateway)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM` (regular SMS number)
- `TWILIO_WHATSAPP_FROM` (format: `whatsapp:+15550002222`)
