# Ansell Employee Day 2026 — Live Multi-Laptop Registration

This version converts the original browser-only registration page into a central real-time application.

## What changed

- Multiple laptops/scanning stations can scan at the same time.
- Every scan is sent to one central Node.js server.
- The server is authoritative for REGISTERED / DUPLICATE / NOT FOUND decisions.
- Simultaneous scans of the same employee cannot both become REGISTERED.
- Scan records are saved centrally in `data/scan-log.json`.
- Socket.IO broadcasts every new scan to all connected laptops immediately.
- The Live Dashboard updates automatically.
- Recent scans show employee number, full employee name, department, time, station and status.
- CSV export exports the central log for all stations.
- Reset clears the central log for all stations.
- Each laptop is assigned a station name the first time it opens the application.

## Requirements

- Node.js 18 or newer
- All scanning laptops and the server computer must be on the same office network/LAN.
- USB barcode readers can be used as keyboard-style scanners.

## Start the server

Open Command Prompt/PowerShell in this folder:

```text
npm install
npm start
```

The server runs on port 3000.

On the server computer, open:

```text
http://localhost:3000
```

## Open from other laptops

Find the server computer's LAN IPv4 address, for example:

```text
ipconfig
```

If the server address is `192.168.1.50`, open this on every scanning laptop:

```text
http://192.168.1.50:3000
```

Do NOT use `localhost` on the other laptops because `localhost` means that individual laptop.

## Windows Firewall

If other laptops cannot connect, allow inbound TCP port 3000 on the server computer's Windows Firewall, or allow Node.js when Windows asks for network access.

## Station names

When a laptop opens the system for the first time, it asks for a station name such as:

- Station 01
- Station 02
- Station 03
- Station 04

The station name is stored in that browser and is included in every scan record.

## Data

Employee master data is in `master.json` and was extracted from the uploaded application. The current source contains 3,731 employee records.

The live scan log is created automatically at:

```text
data/scan-log.json
```

Keep this file backed up if the registration history must be retained.

## Important deployment note

This is designed for a trusted internal LAN/demo environment. For production use, add authentication/authorization, HTTPS, a proper database such as SQL Server/MySQL/PostgreSQL, and restricted admin access for reset/export.
