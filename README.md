<div align="center">

# NSU IT Support Center

### Enterprise Campus IT Operations Platform — Device Management, Ticket Orchestration, Event Coordination & Field Engineering

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![React Native](https://img.shields.io/badge/React_Native-Expo-000020?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Runtime-339933?logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-5-000000?logo=express&logoColor=white)
![Supabase PostgreSQL](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Firebase FCM](https://img.shields.io/badge/Firebase-FCM%20Push-FFCA28?logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-UI%20Engineering-06B6D4?logo=tailwindcss&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT%20%2B%20RBAC%20%2B%20MFA-000000?logo=jsonwebtokens&logoColor=white)
![Helmet](https://img.shields.io/badge/Security-Helmet.js-000000)
![PM2](https://img.shields.io/badge/Process-PM2%20Cluster-2B037A)
![Android](https://img.shields.io/badge/Android-Native%20Build-3DDC84?logo=android&logoColor=white)
![Deployment](https://img.shields.io/badge/Status-LAN%20Production%20Deployed-informational)

</div>

> A production-deployed, full-stack campus IT operations platform engineered for North South University.  
> Centralizes device management, field engineering workflows, ticket orchestration with SLA enforcement, event AV coordination, lab diagnostics, real-time push notifications, automated staff communications, asset registry, inventory, offline mobile support, and enterprise-grade security — across a web portal, public display board, and a native Android field engineer application.

---

<details>
<summary><strong>Table of Contents</strong></summary>

- [Executive Overview](#executive-overview)
- [Problem](#problem)
- [Solution](#solution)
- [System Architecture](#system-architecture)
- [Platform Components](#platform-components)
- [Role-Based Operational Model](#role-based-operational-model)
- [Core Capabilities](#core-capabilities)
- [Authentication & Authorization (Hardened)](#authentication--authorization-hardened)
- [Security & Cybersecurity Layer](#security--cybersecurity-layer)
- [Real-Time Event Architecture](#real-time-event-architecture)
- [Ticket Lifecycle, SLA & Device Pipeline](#ticket-lifecycle-sla--device-pipeline)
- [Campus Support Workspace](#campus-support-workspace)
- [Support Workstation & Hardware Lab](#support-workstation--hardware-lab)
- [Asset Registry, QR Codes & Inventory](#asset-registry-qr-codes--inventory)
- [Event Management System](#event-management-system)
- [Field Engineer Mobile App](#field-engineer-mobile-app)
- [Push Notification System](#push-notification-system)
- [Public Display Board & Walk-In Queue](#public-display-board--walk-in-queue)
- [People & Requesters Directory](#people--requesters-directory)
- [Engineer Performance, Leaderboard & Reporting](#engineer-performance-leaderboard--reporting)
- [Monthly Report System](#monthly-report-system)
- [Audit Logs & Governance](#audit-logs--governance)
- [Automated Email Communication Pipeline](#automated-email-communication-pipeline)
- [Ticket Presence, Watchers & Internal Notes](#ticket-presence-watchers--internal-notes)
- [Operational UX](#operational-ux)
- [Technology Stack](#technology-stack)
- [Engineering Architecture (Modular Backend)](#engineering-architecture-modular-backend)
- [Database Schema](#database-schema)
- [Engineering Decisions](#engineering-decisions)
- [Engineering Challenges Solved](#engineering-challenges-solved)
- [Systematic Deployment & High Availability](#systematic-deployment--high-availability)
- [Monitoring, Logging & Observability](#monitoring-logging--observability)
- [Engineering Ownership](#engineering-ownership)
- [Capabilities Demonstrated](#capabilities-demonstrated)
- [Project Impact](#project-impact)
- [Screenshots](#screenshots)
- [Sample Code](#sample-code)
- [Repository Notice](#repository-notice)
- [Project Classification](#project-classification)
- [Technology Summary](#technology-summary)
- [Final Perspective](#final-perspective)

</details>

---

## Executive Overview

The **NSU IT Support Center** is a full-stack, multi-platform campus operations system engineered to unify every dimension of IT support at North South University into a single, role-aware, auditable, and highly resilient environment.

The system moves well beyond a conventional helpdesk ticketing application. It was designed around the real operational model of a campus IT department: field engineers claiming and resolving device issues across buildings, lab technicians managing diagnostic queues, event AV coordinators assigning staff and equipment, administrators approving escalations and enforcing SLAs, and a mobile-first native application with offline capability for engineers in the field — all connected to the same live database with real-time synchronization, push notifications, and enterprise security controls.

The platform delivers dedicated operational environments for:

- **Super Administrators** — Full system oversight, approval authority, analytics, MFA enforcement
- **Admins** — Queue management, reporting, staff management, event coordination & approval
- **Field Engineers** — Ticket claiming, device intake, status progression, offline field submission, QR scanning
- **Public Display** — Real-time TV board showing active campus and lab queues + walk-in token positions

Supported operational domains include:

- Campus device support and incident management with SLA timers
- Hardware lab diagnostics and repair tracking
- Support workstation queue management
- Persistent asset registry with QR labels, warranty tracking and spare-parts inventory
- AV event coordination with approval workflow, recurring events and equipment checklists
- Campus pool unassigned ticket claiming (web + mobile)
- Monthly performance reporting with PDF generation and leaderboard
- Push notification dispatch to field engineers
- Automated staff email communications (queued)
- Walk-in physical token queue integrated with the display board
- Offline mobile queue, camera attachments, barcode/QR scanner and GPS stamps

The system was developed end-to-end: requirements, database design, modular API engineering, authentication & MFA, real-time infrastructure, mobile application (with offline), email templates, custom PDF generation, push notifications, asset/QR systems, SLA engine, and hardened LAN production deployment.

---

## Problem

Campus IT support at a university-scale institution involves fundamentally more than logging a complaint and changing a status field.

A device support request can require:

- Different intake procedures depending on whether the device comes in physically or is a remote field visit
- Hardware diagnostic routing through a separate lab queue
- Multi-stage status progressions with device asset recording
- Escalation paths requiring admin or super admin approval
- Real-time awareness across multiple concurrent engineers
- Push notification dispatch when new tickets appear
- Offline capability when network is unavailable in the field
- AV equipment coordination for campus events
- Monthly performance accountability per engineer
- Formal PDF reporting with printable layouts
- Public-facing display board visibility for active tickets
- Persistent asset history, warranty tracking and parts inventory
- Strict security, auditability and uninterrupted availability

Without a structured operational platform, these processes fragment across manual communication, shared spreadsheets, and disconnected workflows. The engineering challenge was to model the **complete operational reality** of a campus IT department within a unified, secure and highly available system.

---

## Solution

The NSU IT Support Center was engineered as a unified multi-platform operations system with layered workspaces, real-time data synchronization, role separation, mobile field access (including offline), automated communications, SLA enforcement, asset lifecycle management, and enterprise-grade security & resilience.

```mermaid
flowchart TD
    A[Campus Requester] --> B[Incident Stream<br/>Campus Support Desk]
    B --> C[Field Engineer<br/>Claims & Resolves]
    C -->|Device intake| D[Support Workstation<br/>Hardware Lab]
    C -->|Escalation| E[Admin / Super Admin<br/>Approval & Override]
    D --> F[Resolved · Closed · Returned]
    E --> F
    F --> G[Audit Log · Performance Report · Email]
```

---

## System Architecture

```mermaid
flowchart TD
    subgraph Clients["Client Platforms"]
        W[Web Portal<br/>React 19 + Vite]
        M[Field Engineer App<br/>React Native / Expo]
        D[Public Display Board<br/>Static HTML]
    end

    subgraph API["Application Layer — Node.js + Express.js 5"]
        Auth[Auth & RBAC]
        Tickets[Ticket Workflows]
        Events[Event Management]
        Reports[Reporting & PDF]
        Push[FCM Push Dispatch]
        Mail[Email Engine]
        RT[SSE Realtime Stream]
        Presence[Ticket Presence]
        Audit[Audit Logging]
    end

    subgraph Data["Data Layer — Supabase PostgreSQL"]
        DB[(PostgreSQL Database)]
        RT2[Supabase Realtime]
    end

    subgraph External["External Services"]
        FCM[Firebase FCM]
        Gmail[Gmail / Nodemailer]
    end

    Clients --> API
    API --> Data
    Data --> RT2
    RT2 --> RT
    RT --> W
    API --> FCM
    FCM --> M
    API --> Gmail
```

### Extended Production Architecture (Modular + Resilient)

```mermaid
flowchart LR
    subgraph Edge["Edge / Proxy"]
        N[Nginx<br/>TLS · Static · Upstream]
    end

    subgraph Runtime["Runtime"]
        P[PM2 Cluster]
        S[Modular Express API]
    end

    subgraph State["State & Messaging"]
        R[Redis<br/>Rate Limit · Blacklist · Queues]
        SB[(Supabase PG + RLS)]
        RT[Supabase Realtime]
    end

    subgraph Clients2["Clients"]
        WEB[Web SPA]
        APP[Android App<br/>Offline Capable]
        TV[Display Board]
    end

    WEB & APP & TV --> N
    N --> P
    P --> S
    S --> R
    S --> SB
    SB --> RT
    RT --> S
    S --> FCM[Firebase FCM]
    S --> MailQ[Email Queue]
```

---

## Platform Components

The system is composed of four interconnected platform layers.

| Component | Type | Purpose |
|---|---|---|
| **Web Portal** (`frontend/support-center-react`) | React 19 SPA | Primary operations interface for all staff roles |
| **Backend API** (modular: `routes/`, `middleware/`, `services/`, `controllers/`) | Node.js + Express.js 5 | Business logic, auth, workflows, email, push, PDF, realtime, SLA |
| **Field Engineer App** (`FieldEngineerApp`) | React Native / Expo (Android) | Mobile ticket management with offline support, camera, QR scanner |
| **Public Display Board** (`frontend/display`) | Static HTML | TV board for active campus and lab ticket queues + walk-in tokens |

---

## Role-Based Operational Model

The platform separates every operational responsibility into clearly bounded role environments.

| Role | Access Scope | Primary Operational Authority |
|------|-------------|-------------------------------|
| **Super Admin** | Full system | All routes, settings, audit logs, overrides, MFA enforcement |
| **Admin** | All workspaces | Queue management, reporting, staff, requesters, event approval |
| **Engineer** | Operational workspaces only | Campus pool, workstation, events, my work, offline actions |

```mermaid
flowchart TD
    Auth[Authenticated Session] --> Super[Super Admin]
    Auth --> Admin[Admin]
    Auth --> Eng[Engineer]
    Super --> AllRoutes[All Routes + System Settings]
    Admin --> OpsRoutes[Operational Routes + Reports + Staff]
    Eng --> EngRoutes[Dashboard · Campus Pool · Workstation · Events · My Work]
```

Role enforcement runs at two layers: **Express.js middleware** (`requireRoles`) on every protected API route, and a **React RBAC gate** (`canAccess`) on every protected page route. Access to settings, audit logs, staff management, and reports is confined to Super Admin and Admin roles only.

---

## Core Capabilities

### Incident Stream (Campus Support)

The Incident Stream is the primary live ticket queue for campus support operations. It provides:

- Full ticket table with real-time SSE synchronization
- Multi-dimensional filtering: Status, Priority, Department, Engineer, Date range
- Inline quick-assign dialog for assigning engineers to tickets
- Inline status change with optional comment requirement
- Expandable in-row ticket preview without leaving the list
- Pagination configurable at 15, 30, or 50 records per page
- Real-time search across all ticket fields
- **Ticket Templates** — Pre-filled forms for the 10 most common recurring issues (one-click submit)
- **Bulk Ticket Actions** — Select multiple tickets and assign, change status, or export in one operation
- **Ticket Merge** — Merge duplicate tickets from the same requester into a single record
- **Ticket Reclaim / Reassign** — Admin can forcefully reassign a ticket with full audit entry
- **Internal Notes / Private Comments** — Staff-only notes (excluded from requester email trail)
- **Watchers** — Staff can watch a ticket and receive SSE alerts without being the assigned engineer
- **SLA Timer Engine** — Auto-escalate tickets that exceed defined thresholds (Open > 2h → High, > 4h → Critical + Super Admin notify)

### Device Pipeline

The Device Pipeline provides a physical device tracking view — filtering the ticket queue to tickets that are in hardware-bound stages, allowing administrators to track devices moving through the helpdesk physically.

### Campus Pool (Engineer Ticket Claiming)

The Campus Pool presents unassigned campus support tickets to field engineers. Engineers can:

- Browse unassigned campus and workstation tickets
- Preview ticket details inline before claiming
- One-click claim with server-side ownership assignment
- Immediate workspace refresh after claiming
- Claim from mobile (including offline queue later sync)

### Support Workstation (Lab / Hardware)

The Support Workstation workspace manages device-intake and hardware lab queues separately from the general incident stream.

Supported lab status workflow:

| Status | Description |
|---|---|
| `Brought to Helpdesk` | Physical device received |
| `In Diagnostics` | Under technical assessment |
| `Waiting for Parts` | Parts ordered, pending receipt |
| `In Hardware Lab` | In repair |
| `Send to Hardware` | Routed to hardware team |
| `Support Workstation` | On the support workstation bench |
| `Ready for Return` | Repair complete, waiting for student |
| `Resolved` | Returned and closed |

Engineers performing device intake must supply **Device Type**, **Brand**, and **Asset Tag / Serial Number** before a hardware transition is accepted — enforced at both frontend and backend.

### My Work (Engineer Personal Queue)

The My Work workspace gives engineers a focused view of their own assigned and claimed tickets across both campus and workstation pools, with status and remark update capability.

### Completed Work

A dedicated read-only view of resolved and closed tickets assigned to the authenticated engineer, with time-based filtering.

---

## Authentication & Authorization (Hardened)

| Security Component | Implementation |
|---|---|
| **Access Token** | Short-lived JWT (15 min) |
| **Refresh Token** | Rotating refresh token stored in `httpOnly` cookie |
| **Token Blacklisting** | Server-side blacklist (Redis / in-memory) on logout |
| **MFA / TOTP** | Required for Super Admin & Admin accounts |
| **Password Hashing** | `bcryptjs` with 10+ salt rounds |
| **Password Policy** | Min 10 characters, 1 uppercase, 1 number, 1 special + strength scoring |
| **Brute-Force Protection** | Rate-limit login (5 attempts / IP / 15 min) |
| **Account Lockout** | After N failed attempts → lock + email alert to Super Admin |
| **Session Fingerprinting** | JWT bound to User-Agent + IP subnet |
| **Role Model** | Super Admin → Admin → Engineer, with normalized role resolution |
| **Cache Policy** | All API responses: `no-store, no-cache, must-revalidate` |
| **CORS** | Strict origin whitelist only (no accept-all fallback) |
| **Password Change** | Authenticated route with current-password verification |

```mermaid
sequenceDiagram
    participant Client
    participant API as Express.js API
    participant DB as Supabase PostgreSQL

    Client->>API: POST /api/auth/login (username, password)
    API->>DB: Fetch staff_user by username
    DB-->>API: User record + password_hash
    API->>API: bcrypt.compare(password, hash)
    API->>API: jwt.sign short-lived access + issue rotating refresh
    API-->>Client: Set httpOnly cookies + JSON user object
    Client->>API: Subsequent requests (cookie auto-sent)
    API->>API: jwt.verify + fingerprint check → req.user
    API->>API: requireRoles() middleware check
    API-->>Client: Protected response
```

---

## Security & Cybersecurity Layer

### API & Network Security
- **Helmet.js** — HTTP security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, etc.)
- **Input Sanitization & Validation** — Zod / express-validator schemas on every POST/PUT body
- **Request Size Limiting** — Explicit `express.json({ limit: '50kb' })`
- **API Rate Limiting** — Global limiter + stricter limits on mutation endpoints
- **Sensitive Field Redaction** — Device tokens never returned in full
- **SQL Injection Defense** — Parameterized queries + server-side type coercion
- **Audit Log Tamper Protection** — `audit_logs` marked append-only via PostgreSQL RLS

### Transport
- **HTTPS / TLS** on the LAN (internal CA or self-signed certificate)
- **HSTS** header once HTTPS is active
- **Nginx** terminates SSL and proxies both frontend and API

### Mobile App Security
- Certificate pinning against the backend TLS certificate
- Jailbreak / root detection with warning or block
- Biometric auth gate (`expo-local-authentication`) before showing ticket data
- Secure token storage (`expo-secure-store` — Keychain/Keystore backed)
- ProGuard / R8 minification and obfuscation on production APK

### Infrastructure Security
- Secrets rotated and stored via OS-level environment / secrets manager
- Supabase Row Level Security enabled on all tables
- Least-privilege database role used by the backend (not a full service key)

---

## Real-Time Event Architecture

The platform uses two real-time channels to keep all connected clients synchronized without polling.

### Server-Sent Events (SSE) — Web Portal

The backend maintains a persistent Supabase Realtime WebSocket connection. When database changes occur (ticket inserts, updates), the backend rebroadcasts them to all connected web clients via a shared SSE endpoint `/api/realtime/stream`.

The frontend uses a **shared singleton SSE bus** — one `EventSource` per browser tab, with reference counting so the connection is released when no components are listening. Reconnection uses exponential backoff with jitter.

```mermaid
sequenceDiagram
    participant DB as Supabase PostgreSQL
    participant RT as Supabase Realtime WS
    participant Node as Node.js SSE Publisher
    participant Client as React (Browser Tab)

    DB->>RT: Row change event (INSERT / UPDATE)
    RT->>Node: WebSocket push
    Node->>Client: SSE message → /api/realtime/stream
    Client->>Client: Debounced component refresh (450ms)
```

### Local Mutation Broadcast

After any successful mutation (ticket update, claim, event save), the client immediately dispatches a `CustomEvent` on `window` via `notifyLocalDataChange()` — so the same tab updates instantly without waiting for the server round-trip SSE event.

### Firebase FCM — Mobile Push

When new tickets are created, the backend dispatches a Firebase Cloud Messaging push notification to the `engineers` topic. All logged-in field engineers with registered devices receive an immediate push alert. Delivery receipts are logged and invalid tokens are automatically deactivated.

---

## Ticket Lifecycle, SLA & Device Pipeline

```mermaid
flowchart TD
    A[Ticket Submitted<br/>by Admin / Engineer] --> B[Open — Unassigned]
    B --> C{Assignment}
    C -->|Auto / Manual| D[Assigned to Engineer]
    D --> E{Engineer Action}
    E -->|Field visit| F[In Progress]
    E -->|Device received| G[Brought to Helpdesk]
    G --> H[In Diagnostics / Waiting for Parts]
    H --> I[In Hardware Lab]
    I --> J[Ready for Return]
    F --> K{Outcome}
    J --> K
    K -->|Resolved| L[Resolved · Closed]
    K -->|Escalated| M[Pending Approval]
    M -->|Approved| L
    M -->|Rejected| N[Rejected · Noted]
    L --> O[Audit Log · Email · Report]
```

### SLA Escalation Flow (Complementary View)

```mermaid
stateDiagram-v2
    [*] --> Open
    Open --> HighPriority: > 2 hours open
    HighPriority --> Critical: > 4 hours open
    Critical --> SuperAdminNotified: Auto notify
    Open --> Assigned: Claim / Assign
    HighPriority --> Assigned
    Critical --> Assigned
    Assigned --> InProgress
    InProgress --> Resolved
    Resolved --> [*]
```

---

## Campus Support Workspace

The Incident Stream provides the primary campus support ticket management surface.

| Capability | Detail |
|---|---|
| Live queue | SSE-synchronized, no manual refresh needed |
| Filters | Status · Priority · Department · Engineer · Date range |
| Search | Full-text across all ticket fields |
| Inline assign | Dialog-based engineer assignment from the list |
| Inline status | Status change with configurable comment enforcement |
| Ticket preview | Expandable row preview without page navigation |
| Pagination | 15 / 30 / 50 records |
| Priority indicators | Color-coded High and Critical priority visual treatment |
| Templates | One-click pre-filled common issues |
| Bulk actions | Multi-select assign / status / export |
| Merge / Reassign | Admin tools with audit trail |
| Internal notes | Staff-only comments |
| Watchers | SSE alerts without assignment |
| SLA indicators | Live timer + automatic escalation |

---

## Support Workstation & Hardware Lab

The Support Workstation workspace operates as the **physical device management centre**.

Engineers working the support workstation can:

- Monitor the full lab queue with sub-status filtering
- Claim unassigned hardware tickets
- Record device intake: type, brand, asset tag, serial number
- Progress devices through diagnostic and repair stages
- Mark devices as Ready for Return
- Resolve and close tickets
- Link consumption of spare parts to the ticket

The **Hardware Lab** sub-filter isolates tickets in deep hardware stages (`In Hardware Lab`, `Waiting for Parts`, `Send to Hardware`) from the general support workstation queue.

```mermaid
flowchart LR
    A[Brought to Helpdesk] --> B[In Diagnostics]
    B --> C[Waiting for Parts]
    C --> D[In Hardware Lab]
    D --> E[Ready for Return]
    E --> F[Resolved]
```

---

## Asset Registry, QR Codes & Inventory

- **Asset Registry** — Persistent device records (laptop / printer / projector etc.) with full repair history across all tickets
- **QR Code Labels** — Generate and print QR labels per asset; scan (web or mobile) to instantly pull up device history and related tickets
- **Warranty Tracking** — Expiry date per device with automated warning notifications before expiry
- **Spare Parts Inventory** — Track quantities, auto-warn on low stock, and link part consumption directly to tickets

---

## Event Management System

The Event Management System handles AV coordination for university events — conferences, seminars, board meetings, and special occasions requiring IT and AV support.

### Event Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Upcoming
    Upcoming --> SetupInProgress: Setup begins
    SetupInProgress --> Ongoing: Event live
    Ongoing --> StandbyMonitoring: Intermission
    StandbyMonitoring --> Ongoing: Resumed
    Ongoing --> Ended: Event concludes
    Ended --> TeardownComplete: Equipment secured
    TeardownComplete --> [*]
```

### Event Fields

| Field Category | Fields |
|---|---|
| **Core** | Name, Date, Start time, End time, Venue, Building, Room |
| **Organizer** | Department, Organizer, On-site coordinator, VIP contact |
| **Assignment** | Primary / Lead engineer, Backup IT, Additional crew |
| **Equipment** | AV manifest (structured items with qty, type, notes) |
| **Online** | Meeting platform, Meeting account, Meeting link |
| **Admin** | Approval status, Event status, Notes |

### Additional Capabilities

- **Event Approval Workflow** — Events created by engineers enter `Pending Approval`; Admins approve/reject before assignment emails are sent
- **Recurring Events** — Mark events as weekly/monthly with automatic creation
- **Equipment Checklist** — Pre-event and post-event AV equipment checklist that engineers check off in the app
- **Event Calendar View** — Monthly/weekly calendar grid alongside the list view
- **Post-Event Notes / Teardown Report** — Engineers submit a brief post-event report

### Assignment Email Automation

When an event is created or modified with engineer assignments (after approval), the backend resolves each engineer’s email from the staff directory and dispatches personalized HTML assignment emails. Each engineer receives:

- Their specific role (Primary Lead / Backup Support)
- Full event details and schedule
- Equipment manifest
- Meeting link (if applicable)
- The full support crew listing
- A tokenized deep-link to view the event in the portal

### Event Reminder System

One hour before an event begins, the backend dispatches reminder emails to all assigned engineers (scheduled job).

### Public Event View

A tokenized public URL (`/e/:token`) renders a read-only event detail card, accessible without authentication. The token is HMAC-signed server-side.

```mermaid
sequenceDiagram
    participant Admin
    participant API
    participant DB
    participant Engineer

    Admin->>API: POST /api/events (create or update)
    API->>DB: Save event record + event_history entry
    API->>DB: Resolve engineer emails (staff_users)
    API->>Engineer: Personalized HTML assignment email
    API-->>Admin: Event saved response
```

---

## Field Engineer Mobile App

The `FieldEngineerApp` is a native Android application built with **React Native / Expo**, providing field engineers with on-the-go access to their ticket queue and campus support operations.

### Mobile Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native 0.81.5 / React 19 |
| **Build System** | Expo SDK 54 / EAS Build |
| **Navigation** | Expo Router 6 (file-based routing) |
| **Push Notifications** | `expo-notifications` + `@notifee/react-native` |
| **Storage** | `@react-native-async-storage/async-storage` + `expo-secure-store` |
| **HTTP** | `axios` |
| **Language** | TypeScript 5.9 |
| **Auth Gate** | `expo-local-authentication` (biometric) |

### Mobile Capabilities

- **Ticket queue browsing** — View and filter assigned and available tickets
- **Push notification receipt** — FCM push delivered via Firebase, displayed via Notifee
- **Device claim from mobile** — Engineers can claim unassigned tickets in the field
- **Status updates** — Progress ticket status directly from the mobile interface
- **Login and session** — JWT-authenticated session with the same backend API
- **Offline Queue** — Cache assigned tickets locally; update status and notes offline; sync when network is restored
- **Camera / Photo Attachment** — Photograph device damage; image attached to ticket
- **Barcode / QR Scanner** — Scan device asset tag to instantly pull up and claim the ticket
- **GPS Location Stamp** — Optionally record engineer’s building/floor location when a ticket is resolved in the field
- **Engineer-to-Engineer Chat** — Lightweight in-app message thread per ticket for field coordination

### Push Notification Flow

```mermaid
sequenceDiagram
    participant App as Field Engineer App
    participant FCM as Firebase FCM
    participant API as Node.js Backend
    participant DB as Supabase

    App->>FCM: Register device token
    App->>API: POST /api/auth/subscribe (token, username)
    API->>FCM: subscribeToTopic(token, 'engineers')
    API->>DB: Upsert device_tokens record
    Note over API,DB: On new ticket creation:
    API->>FCM: sendToTopic('engineers', notification)
    FCM->>App: Push notification delivered
```

---

## Push Notification System

The backend integrates **Firebase Admin SDK** for server-side FCM topic messaging.

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/subscribe` | Register device token + subscribe to `engineers` FCM topic |
| `POST /api/auth/unsubscribe` | Unsubscribe device and deactivate token in DB |
| `GET /api/auth/devices` | Admin view of registered device tokens (redacted) |

All device registrations are persisted in the `device_tokens` table. Delivery results are logged; invalid tokens are deactivated automatically.

---

## Public Display Board & Walk-In Queue

The `frontend/display/index.html` is a static HTML display board designed for TV screens in the IT support area. It polls the public `/api/display/board` endpoint (no authentication required) and renders:

- **Desk Queue** — Active campus support tickets with Open / In Progress / Waiting for Device status
- **Lab Queue** — Active hardware lab tickets with diagnostic and repair statuses
- **Walk-In Token System** — Physical number taken at the helpdesk counter; live position shown on the TV board

The board refreshes automatically, indicates stale data if the API is unreachable, and is designed for continuous display on a wall-mounted monitor.

---

## People & Requesters Directory

The Requesters module provides a full campus people directory, pulling from the `users` table.

| Capability | Detail |
|---|---|
| Search | Name, department, designation, building, room, extension |
| Filters | Department facet, Building facet |
| Sort | Alphabetical, Department, Most recent |
| Pagination | Server-side, full dataset access (not capped) |
| Profile view | Full user card with ticket history counts |
| Ticket history | Paginated per-requester ticket list with status filtering |
| Create / Edit | Add and update requester profiles |
| Deduplication | Smart in-page deduplication by name, preferring fullest profile |
| **Campus Directory Import** | Bulk import from university CSV / LDAP feed |

---

## Engineer Performance, Leaderboard & Reporting

### Engineer Reports

The Reports workspace provides workload analytics per engineer across configurable time periods.

| Metric | Description |
|---|---|
| Total assigned | All tickets assigned to this engineer |
| Open | Currently open tickets |
| In Progress | Active diagnostic/repair tickets |
| Resolved | Completed tickets |
| Period filters | Daily, Monthly, All-time |

### Engineer Performance Dashboard & Leaderboard

Cross-engineer comparison views for administrative oversight, plus a ranking by resolution count, resolution time and satisfaction.

### Live Operations Dashboard

Real-time KPI tiles (tickets opened today, resolved today, average resolution time, engineer workload gauges) auto-refreshed via SSE.

### Additional Reporting

- Department-level aggregate volume and resolution rates
- Weekly / monthly trend charts per category and status
- CSV / Excel export of any filtered ticket table

### Report Components

| Component | Purpose |
|---|---|
| `ReportKpis` | Key metric tiles (totals, rates, trends) |
| `ReportCharts` | Visual data representations |
| `ReportTable` | Tabular record view with sorting |
| `ReportFilters` | Date, engineer, and period filter controls |
| `ReportSubNav` | Report section navigation |
| `EngineerSummary` | Individual engineer summary card |

---

## Monthly Report System

The Monthly Report system provides each engineer with a formal monthly performance report, available both as a web view and as a PDF download.

### Monthly Report PDF Engine

The PDF generation engine is built entirely in vanilla Node.js — zero external PDF libraries in the core generation logic. It implements:

- **Real Helvetica font metrics** — Every cell is measured and fitted using per-glyph advance-width tables
- **WinAnsi encoding** — En-dashes, em-dashes, smart quotes, and bullet characters render correctly
- **Table header repetition** — Column headers repeat on every continuation page
- **Lazy page creation** — New pages are added only when content overflows
- **Logo embedding** — Automatically locates and embeds logo assets from the public directory
- **Bank-statement layout** — Professional tabular layout matching the web report design

### Monthly Report Email

When a report is dispatched, the engineer receives a branded HTML email containing:

- Summary metric tiles (total assigned, completed, in-progress, pending, cancelled, event support)
- PDF attachment of the full individual report
- CTA button linking to the web report view

---

## Audit Logs & Governance

Every significant system action is recorded in the `audit_logs` table.

| Field | Description |
|---|---|
| `actor_name` | Name of the performing staff member |
| `actor_role` | Normalized role at time of action |
| `action` | Semantic action key (`auth.login`, `ticket.update`, etc.) |
| `entity_type` | Type of affected entity (`ticket`, `staff_user`, etc.) |
| `entity_id` | ID of the affected record |
| `details` | JSON payload with action-specific context |
| `ip` | Client IP address |
| `created_at` | Timestamp |

The audit log is accessible to Admin and Super Admin roles via the AuditLogs page, with filtering by action type, entity type, and full-text search across all fields.

```mermaid
flowchart TD
    A[Any Significant Action] --> B[writeAuditLog helper]
    B --> C{Insert to audit_logs}
    C -->|Success| D[Record persisted]
    C -->|Failure| E[Warn-log only — never throws to caller]
```

> The audit system is designed to be **non-blocking**: a failure to write an audit record never interrupts the primary operation.  
> The table is protected by PostgreSQL RLS as **append-only**.

---

## Automated Email Communication Pipeline

The email module provides the complete communication layer, covering event lifecycle, reminders, and monthly reports. All sends are routed through a queue so SMTP latency never blocks API responses and failed emails retry automatically.

### Email Templates

| Template | Trigger | Recipients |
|---|---|---|
| **Event Assignment** | New engineer assigned to event (after approval) | Assigned engineers (personalized) |
| **Event Assignment Update** | Assignment or event details changed | Affected engineers |
| **Event Withdrawal** | Engineer removed from assignment | Removed engineer |
| **Event Reminder** | 1 hour before event start | All assigned engineers |
| **Monthly Report** | Report dispatch action | Individual engineer |

### Email Design System

All HTML emails use a **mobile-first, single-column, table-based layout** compatible with Gmail, Outlook, and Apple Mail. Each template supports:

- Gradient branded header with theme color per email type
- Fact row layout (icon · label · value)
- Event card with schedule, venue, and equipment chip display
- Team member listing with role badges (Primary Lead / Backup Support)
- Meeting link CTA block
- Responsive mobile breakpoints via media queries

| Theme | Use |
|---|---|
| `assigned` (indigo) | New assignment |
| `updated` (purple) | Assignment change |
| `reminder` (orange) | Pre-event reminder |
| `withdrawn` (slate) | Removal from assignment |
| `report` (teal) | Monthly report |

---

## Ticket Presence, Watchers & Internal Notes

The platform includes a **Messenger-style ticket presence indicator** — when multiple engineers open the same ticket simultaneously, each sees who else is currently viewing or editing.

| Mode | Display |
|---|---|
| `viewing` | "Also viewing: [Name]" |
| `editing` | "Also editing: [Name]" |
| `leave` | Peer removed from presence list |

Presence state is propagated through the SSE bus using a dedicated presence channel. A `keepalive: true` fetch on `beforeunload` and `pagehide` ensures timely peer departure even on tab close.

**Watchers** can subscribe to a ticket and receive SSE alerts on updates without being the assigned engineer.  
**Internal notes** are visible only to staff and never appear in requester-facing communications.

---

## Operational UX

The administrative interfaces are engineered for high-frequency operational use by support staff throughout the working day.

### Issue Description LRU

An in-memory LRU cache (up to 200 entries) stores recently typed issue descriptions, allowing engineers to autocomplete frequently repeated issue types. This operates entirely server-side without any database or localStorage dependency.

### Device Intake Dialogs

When an engineer transitions a ticket to a device-required status (`Brought to Helpdesk`, `In Hardware Lab`), an inline intake dialog prompts for device details before the status change is committed — preventing incomplete hardware records.

### Notification Engine

| Type | Purpose |
|---|---|
| **Info** | General operational feedback |
| **Success** | Completed actions (claim, update, assign) |
| **Warning** | Required fields, potential data issues |
| **Error** | Failed operations, server errors |

### Additional UX Features

- Printable ticket reports
- Command palette for rapid workspace access
- Contextual shortcuts (NSU ID / email copy, extension call, status chips)
- Real-time search with debounce
- Toast-based async feedback on every mutation
- **Dark / Light mode toggle**
- Keyboard shortcuts for common actions (claim, resolve, next ticket)
- “Last Seen” indicator on engineers
- Duplicate ticket detection warning (same requester + same category within a short window)

---

## Technology Stack

| Layer | Technology | Engineering Role |
|-------|------------|-----------------|
| **UI Library** | `React 19` | Component-based interface engineering |
| **Mobile Framework** | `React Native 0.81.5` | Native Android field engineer application |
| **Mobile Build** | `Expo SDK 54 / EAS` | Cross-platform native build and OTA updates |
| **Client Routing** | `React Router DOM 7` | Web SPA navigation and route management |
| **Build Tooling** | `Vite 6` | Development server and production bundling |
| **UI Engineering** | `Tailwind CSS` | Utility-first responsive design system |
| **Language (Mobile)** | `TypeScript 5.9` | Type-safe mobile application code |
| **Backend Runtime** | `Node.js` | Server-side application execution |
| **API Layer** | `Express.js 5` (modular) | HTTP API, middleware, and routing |
| **Database** | `Supabase PostgreSQL` + RLS | Persistent relational data storage |
| **Realtime** | `Supabase Realtime` | Database change propagation via WebSocket |
| **SSE Bus** | `Server-Sent Events` | Browser realtime synchronization |
| **Authentication** | `JWT` + rotating refresh + MFA | Stateless session management |
| **Credential Security** | `bcryptjs` | One-way password hashing |
| **Push Notifications** | `Firebase Admin SDK + FCM` | Mobile push dispatch and topic messaging |
| **Email** | `Nodemailer` + queue | Transactional email via Gmail SMTP |
| **PDF Generation** | Custom pure-Node PDF engine | Monthly report PDF without external libraries |
| **Mobile Push** | `expo-notifications + @notifee/react-native` | Mobile push receipt and display |
| **Mobile HTTP** | `axios` | Mobile API communication |
| **Security Middleware** | Helmet.js, Zod, rate-limit | Headers, validation, throttling |
| **Process Manager** | PM2 cluster | Multi-core, zero-downtime, auto-restart |
| **Reverse Proxy** | Nginx | TLS termination, static serving, upstream |

---

## Engineering Architecture (Modular Backend)

The platform is composed of five cooperating layers across web and mobile. The previous monolithic `server.js` has been fully decomposed into a professional modular structure.

```mermaid
flowchart TD
    P["Presentation Layer<br/>React 19 · React Router DOM 7 · Tailwind CSS · Vite 6"] --> A
    PM["Mobile Layer<br/>React Native 0.81.5 · Expo SDK 54 · TypeScript · Expo Router"] --> A
    A["Application Layer<br/>Node.js · Express.js 5 · RBAC · JWT · Business Workflows"] --> D
    D["Data Layer<br/>Supabase PostgreSQL · audit_logs · ticket_history · events"] --> R
    R["Real-Time & Notification Layer<br/>Supabase Realtime · SSE Bus · Firebase FCM · Nodemailer · PDF Engine"]
```

### Backend Directory Structure

```
backend/
├── server.js                 # Entry point only
├── config/                   # Env, CORS, rate-limit, helmet
├── middleware/               # auth, rbac, validate, rateLimit, errorHandler
├── routes/                   # auth, tickets, events, assets, reports, presence, display...
├── controllers/              # Thin request handlers
├── services/                 # Business logic (SLA, email, PDF, FCM, assets...)
├── schemas/                  # Zod validation schemas
├── utils/                    # helpers, audit, presence, lru
└── jobs/                     # Scheduled tasks (SLA escalation, reminders, cleanup)
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Campus requesters directory (name, department, building, room, extension) |
| `tickets` | Support ticket records with device fields and status lifecycle |
| `ticket_history` | Per-ticket status change audit trail |
| `events` | AV event records with assignment, schedule, and equipment |
| `event_history` | Per-event change audit with human-readable diff summaries |
| `staff_users` | Authenticated staff accounts (bcrypt hash, role, is_active) |
| `staff_push_tokens` | Expo push token registry per staff member |
| `device_tokens` | FCM device tokens for Firebase topic messaging |
| `audit_logs` | System-wide actor · action · entity audit log (append-only via RLS) |
| `settings` | Configurable system values (ticket status catalog, etc.) |
| `assets` | Persistent device registry with repair history |
| `asset_history` | Cross-ticket repair / movement history per asset |
| `spare_parts` | Inventory quantities and low-stock thresholds |
| `part_consumption` | Parts used linked to specific tickets |
| `ticket_templates` | Pre-filled common issue forms |
| `ticket_watchers` | Staff watching tickets for SSE alerts |
| `internal_notes` | Staff-only private comments on tickets |
| `walk_in_tokens` | Physical helpdesk queue numbers |
| `staff_availability` | On-shift / off-shift / leave calendar |
| `refresh_tokens` | Rotating refresh token store / blacklist support |

Soft-delete (`deleted_at`) is used on major entities where appropriate. Full RLS policies are enabled on all tables.

---

## Engineering Decisions

### Why a Multi-Platform Architecture?

Campus IT engineers operate in the field — in classrooms, labs, offices, and event venues. A web-only platform would be insufficient for real operational coverage. The native Android application provides on-the-go queue visibility, claim capability and offline support, while the web portal handles all administrative and analytical operations.

### Why Server-Sent Events (SSE) Rather Than WebSockets?

SSE is unidirectional (server → client), which precisely matches the synchronization requirement: the server notifies clients of database changes. It is significantly simpler to implement, requires no additional infrastructure, and works through standard HTTP — well-suited for a LAN-deployed system. Exponential backoff with jitter prevents reconnect storms.

### Why a Custom PDF Engine?

The monthly report PDF needed precise typographic control — real Helvetica advance-width measurements, correct WinAnsi encoding for special characters, and table header repetition. The result is a professionally formatted document that matches the web layout exactly, without external rendering overhead.

### Why Firebase FCM for Mobile Push?

FCM topic messaging allows the backend to broadcast to all subscribed field engineer devices with a single API call, without maintaining a per-device dispatch loop. Delivery receipts and automatic token cleanup keep the registry healthy.

### Why an In-Memory LRU for Issue Descriptions?

Issue description autocomplete operates at high frequency during ticket submission. A database query per keystroke would add latency and DB load. An in-memory LRU capped at 200 entries provides instant autocomplete with zero database reads, appropriate for a single-instance LAN deployment.

### Why Supabase Realtime + SSE Bridging?

Supabase Realtime provides reliable change-data-capture from PostgreSQL. The backend bridges these WebSocket events into SSE for browser clients, allowing a single backend WebSocket connection to Supabase to serve many simultaneous browser SSE clients.

### Why Modular Backend Architecture?

A single 5,000+ line file creates high risk of cross-domain breakage and makes onboarding and testing difficult. Splitting into routes, middleware, controllers, services and jobs gives clear ownership boundaries, easier testing and safer evolution of individual domains (tickets, events, assets, auth, etc.).

### Why Short-Lived Access Tokens + Rotating Refresh?

An 8-hour static JWT creates a long exposure window if a cookie is stolen. Short-lived access tokens (15 min) combined with rotating refresh tokens and server-side blacklisting dramatically reduce the useful lifetime of a compromised session.

### Why bcrypt with 10+ Salt Rounds?

Staff credentials require one-way protection. bcrypt’s adaptive cost factor provides future-resistant credential hashing appropriate for an institutional deployment.

---

## Engineering Challenges Solved

<details>
<summary><strong>01 — Multi-Platform Real-Time Synchronization</strong></summary>

**Challenge:** Web users, mobile field engineers, and the public display board all need live data, but the architecture differs across platforms.

**Engineering Response:**
- Web portal: shared singleton SSE bus with Supabase Realtime bridging + exponential backoff
- Mobile: FCM push notifications for new ticket alerts + API polling / offline queue for state
- Display board: periodic API polling against the public `/api/display/board` endpoint with stale-data indication

**Engineering Outcome:** Each platform receives appropriate real-time updates without over-engineering a single transport layer for all clients.

</details>

<details>
<summary><strong>02 — Device Intake Data Integrity</strong></summary>

**Challenge:** Hardware-bound status transitions require device information (type, brand, serial) that engineers sometimes skip under operational pressure.

**Engineering Response:** The dashboard and ticket detail views intercept device-required status transitions with an inline intake dialog that cannot be bypassed. The backend also validates device fields on hardware-stage update requests. Asset Registry further enforces persistent device identity.

**Engineering Outcome:** Hardware lab records consistently contain the device information needed for tracking, return verification, and reporting.

</details>

<details>
<summary><strong>03 — Event Assignment Email Personalization</strong></summary>

**Challenge:** Each engineer assigned to an event needs a personalized email that reflects their specific role (Primary Lead vs Backup Support), without exposing other engineers’ contact details unnecessarily.

**Engineering Response:** The assignment email builder resolves each recipient’s role against the event’s assignment fields and constructs a fully personalized email per engineer. Staff email addresses are resolved server-side. Approval workflow gates the send until an Admin approves.

</details>

<details>
<summary><strong>04 — PDF Generation Without External Libraries</strong></summary>

**Challenge:** The monthly report PDF needed precise typographic control — column text that cannot overflow, correct special-character encoding, and repeating table headers.

**Engineering Response:** A custom low-level PDF writer was built in pure Node.js using raw PDF syntax, Helvetica advance-width tables, zlib stream compression, image embedding, and WinAnsi character mapping.

**Engineering Outcome:** The PDF matches the web report layout precisely, with zero text overlap regardless of content length, and renders correctly across PDF viewers.

</details>

<details>
<summary><strong>05 — Ticket Presence Without a Database Table</strong></summary>

**Challenge:** Showing “who else is viewing this ticket right now” requires ephemeral state that should not persist across server restarts or accumulate stale records.

**Engineering Response:** Ticket presence is managed as an in-memory data structure on the backend, propagated to clients via the SSE bus using a dedicated presence channel. `beforeunload` and `pagehide` events trigger keepalive fetches to remove departing peers immediately.

</details>

<details>
<summary><strong>06 — RBAC Across Two Enforcement Points</strong></summary>

**Challenge:** Role enforcement must be consistent between the backend API and the frontend routing — an engineer must not be able to reach admin-only pages even if they construct a URL manually.

**Engineering Response:** Role normalization runs at both enforcement points from shared logic. The backend `requireRoles()` middleware and the frontend `canAccess()` function implement the same role hierarchy.

</details>

<details>
<summary><strong>07 — Security Hardening & Resilience Gaps</strong></summary>

**Challenge:** Original system lacked HTTPS, rate limiting, input validation, Helmet headers, process management, monitoring and modular structure.

**Engineering Response:** Full security stack (Helmet, Zod, rate-limit, CORS whitelist, short-lived tokens + MFA, RLS, TLS), PM2 cluster + Nginx + blue-green, structured logging, health checks, Sentry, Uptime Kuma, email queues, and complete modularization of the backend.

**Engineering Outcome:** The system is now enterprise-grade in security posture, operational resilience and maintainability.

</details>

---

## Systematic Deployment & High Availability

The system is deployed on a **campus LAN** at a fixed host IP, with Nginx in front of the React SPA and the modular API.

```mermaid
flowchart TD
    A[Requirements & Workflow Analysis] --> B[Database Schema Design]
    B --> C[Modular API Engineering]
    C --> D[Frontend Web Portal]
    D --> E[React Native Mobile App]
    E --> F[Firebase FCM Integration]
    F --> G[Email Template + Queue Engineering]
    G --> H[PDF Report Engine]
    H --> I[Real-Time SSE Infrastructure]
    I --> J[Role-Based Access Control + MFA]
    J --> K[Audit Logging + RLS]
    K --> L[Security Hardening + PM2 / Nginx]
    L --> M[Operational System]
```

### Deployment Features

- **PM2 cluster mode** (`-i max`) with startup script for auto-restart on reboot
- **Graceful shutdown** — drain SSE connections, close DB pools, finish in-flight requests on `SIGTERM`/`SIGINT`
- **Health check endpoint** — `GET /health` returns `{ status, uptime, dbConnected, timestamp }`
- **Nginx reverse proxy** — SSL termination, static file serving, compression, upstream failover
- **Blue-green deployment** — deploy to inactive instance, smoke-test, switch Nginx upstream (zero downtime)
- **SSE reconnection hardening** — exponential backoff (3.5s → 7s → 14s → 30s max) with jitter
- **Database connection pooling** — PgBouncer / Supabase transaction-mode pooler
- **Supabase Realtime reconnect loop** with backoff
- **FCM delivery receipts** + automatic deactivation of invalid tokens
- **Email queue** with automatic retry so SMTP timeouts never block API responses
- **CI/CD** — GitHub Actions pipeline (lint → test → build → SSH deploy → PM2 reload)
- **Frontend caching** — hashed assets with long `max-age` + `index.html` with `no-cache`

---

## Monitoring, Logging & Observability

- **Uptime Kuma** (self-hosted on LAN) monitors `/health` every 30 seconds and alerts on downtime
- **Structured logging** (Winston / Pino) — JSON logs with levels, timestamps and correlation IDs, written to rotating files
- **Sentry** (self-hosted Community edition) captures unhandled exceptions with stack traces, request context and user identity
- **Resource monitoring** — CPU, RAM, disk via netdata or Prometheus + Grafana on the LAN
- **Database query monitoring** — indexes on hot columns (`tickets.status`, `tickets.assigned_engineer`, `tickets.created_at`, `events.event_date`) + Supabase query performance advisor

---

## Engineering Ownership

This project represents **end-to-end software engineering ownership** across multiple layers and platforms:

- Requirement interpretation and operational workflow modeling
- Multi-table relational database schema design + RLS policies
- Full modular REST API engineering with Express.js 5
- Role-based authentication, authorization, MFA and session hardening
- Real-time SSE infrastructure and Supabase Realtime bridging
- React 19 SPA with component-based architecture
- React Native + Expo native Android application (offline, camera, QR, biometric)
- Firebase Admin SDK integration for FCM push dispatch
- Branded HTML email template engineering + queue
- Custom pure-Node PDF generation engine with font metrics
- Event management and AV coordination workflows (approval, recurring, checklists)
- Hardware device intake, lab diagnostic tracking and asset registry
- SLA timer engine and automatic escalation
- Monthly performance reporting with per-engineer PDF delivery + leaderboard
- System-wide audit logging (append-only)
- Campus people directory with server-side pagination and bulk import
- Ticket presence / co-viewing awareness + watchers + internal notes
- Walk-in token system integrated with the public display board
- Hardened LAN production deployment (PM2, Nginx, blue-green, monitoring)

---

## Capabilities Demonstrated

### Software Engineering
- Full-stack multi-platform application development
- System architecture across web, mobile and backend
- Modular API design and business logic engineering
- Workflow modeling for real-world operational requirements
- Integration engineering (Firebase, Supabase, Gmail SMTP, Redis)

### Backend Engineering
- Node.js + Express.js 5 modular architecture
- JWT + rotating refresh + MFA authentication and RBAC middleware
- Server-Sent Events (SSE) realtime infrastructure
- Supabase Realtime WebSocket bridging
- Firebase Admin SDK and FCM topic messaging
- Nodemailer transactional email + queue
- Custom PDF generation (pure Node.js)
- In-memory LRU caching
- System audit logging (append-only)
- SLA escalation jobs and scheduled tasks

### Data Engineering
- PostgreSQL relational schema design + Row Level Security
- Supabase Realtime change-data-capture
- Server-side pagination with faceted filtering
- Ticket history, event history and asset history audit trails
- Soft-delete patterns

### Mobile Engineering
- React Native 0.81.5 with Expo SDK 54
- TypeScript application development
- Expo Router file-based navigation
- FCM push notification receipt via expo-notifications + Notifee
- Offline queue + sync
- Camera / photo attachment, barcode/QR scanner, GPS stamp
- Secure storage + biometric gate
- EAS native Android build

### Security Engineering
- Short-lived JWT + rotating refresh + server-side blacklist
- MFA / TOTP for privileged roles
- bcryptjs credential hashing
- Dual-layer RBAC (backend middleware + frontend route guard)
- Helmet.js security headers
- Zod input validation on every mutation
- Rate limiting and account lockout
- Session fingerprinting
- CORS strict whitelist
- HTTPS / TLS + HSTS on LAN
- Certificate pinning, root detection, biometric gate, secure token storage on mobile
- Append-only audit logs via RLS
- Least-privilege database roles

### Frontend Engineering
- React 19 component architecture
- React Router DOM 7 client-side routing
- Vite 6 build tooling
- Tailwind CSS responsive design + dark/light mode
- SSE-driven real-time synchronization
- Ticket presence co-viewing awareness
- Composable report component system
- Printable document styling
- Command palette and keyboard shortcuts

---

## Project Impact

The NSU IT Support Center unifies multiple previously fragmented IT operations workflows into a single platform, covering the complete lifecycle from ticket creation through resolution, with accountability trails, automated communications, mobile field access (including offline), asset lifecycle tracking and enterprise security.

```mermaid
flowchart TD
    A[Campus Requester] --> B[Submit / Reported / Walk-In Token]
    B --> C[Triaged & Assigned]
    C --> D[Field Visit or Device Intake]
    D --> E[Diagnostic / Repair + Asset History]
    E --> F[Resolved / Returned]
    F --> G[Automated Communication]
    G --> H[Audit Trail + Report + Leaderboard]
```

Engineers in the field receive push notifications the moment new tickets arrive and can continue working offline. Administrators see live ticket state and KPIs without refreshing. Event AV assignments trigger personalized emails only after approval. Monthly reports are generated and delivered as PDF attachments. Assets have permanent histories and QR labels. Every administrative action is permanently recorded. The system recovers automatically from process crashes and supports zero-downtime releases.

---

## Screenshots

<details>
<summary><strong>Web Portal — 1 to 12</strong></summary>
<br>

| | | |
|:---:|:---:|:---:|
| <img src="screenshots/web/1.png" width="280"/> | <img src="screenshots/web/2.png" width="280"/> | <img src="screenshots/web/3.png" width="280"/> |
| <img src="screenshots/web/4.png" width="280"/> | <img src="screenshots/web/5.png" width="280"/> | <img src="screenshots/web/6.png" width="280"/> |
| <img src="screenshots/web/7.png" width="280"/> | <img src="screenshots/web/8.png" width="280"/> | <img src="screenshots/web/9.png" width="280"/> |
| <img src="screenshots/web/10.png" width="280"/> | <img src="screenshots/web/11.png" width="280"/> | <img src="screenshots/web/12.png" width="280"/> |

</details>

<details>
<summary><strong>Web Portal — 13 to 24</strong></summary>
<br>

| | | |
|:---:|:---:|:---:|
| <img src="screenshots/web/13.png" width="280"/> | <img src="screenshots/web/14.png" width="280"/> | <img src="screenshots/web/15.png" width="280"/> |
| <img src="screenshots/web/16.png" width="280"/> | <img src="screenshots/web/17.png" width="280"/> | <img src="screenshots/web/18.png" width="280"/> |
| <img src="screenshots/web/19.png" width="280"/> | <img src="screenshots/web/20.png" width="280"/> | <img src="screenshots/web/21.png" width="280"/> |
| <img src="screenshots/web/22.png" width="280"/> | <img src="screenshots/web/23.png" width="280"/> | <img src="screenshots/web/24.png" width="280"/> |

</details>

<details>
<summary><strong>Web Portal — 25 to 36</strong></summary>
<br>

| | | |
|:---:|:---:|:---:|
| <img src="screenshots/web/25.png" width="280"/> | <img src="screenshots/web/26.png" width="280"/> | <img src="screenshots/web/27.png" width="280"/> |
| <img src="screenshots/web/28.png" width="280"/> | <img src="screenshots/web/29.png" width="280"/> | <img src="screenshots/web/30.png" width="280"/> |
| <img src="screenshots/web/31.png" width="280"/> | <img src="screenshots/web/32.png" width="280"/> | <img src="screenshots/web/33.png" width="280"/> |
| <img src="screenshots/web/34.png" width="280"/> | <img src="screenshots/web/35.png" width="280"/> | <img src="screenshots/web/36.png" width="280"/> |

</details>

<details>
<summary><strong>Web Portal — 37 to 46</strong></summary>
<br>

| | | |
|:---:|:---:|:---:|
| <img src="screenshots/web/37.png" width="280"/> | <img src="screenshots/web/38.png" width="280"/> | <img src="screenshots/web/39.png" width="280"/> |
| <img src="screenshots/web/40.png" width="280"/> | <img src="screenshots/web/41.png" width="280"/> | <img src="screenshots/web/42.png" width="280"/> |
| <img src="screenshots/web/43.png" width="280"/> | <img src="screenshots/web/44.png" width="280"/> | <img src="screenshots/web/45.png" width="280"/> |
| <img src="screenshots/web/46.png" width="280"/> | | |

</details>

---

## Sample Code

A selection of representative code portions has already been uploaded to this repository to illustrate architecture, modular structure, middleware patterns, validation, SLA handling and key domain logic.

Due to institutional restrictions on a production campus IT system, the complete source code, internal configuration, credentials and sensitive operational data are not publicly exposed. The samples present in the repo demonstrate the professional patterns used throughout the system (route modularization, Zod validation, RBAC middleware, service-layer separation, etc.).

---

## Repository Notice

This repository is maintained as a **professional technical showcase and engineering case study**.

The NSU IT Support Center is a deployed operational system serving the IT department of North South University. Its full source code, internal configuration, credentials, infrastructure details, and sensitive organizational data are intentionally not publicly exposed.

This documentation covers the system at the architecture, capability, and engineering level to demonstrate the scope and depth of the engineering work. Screenshots and selected sample code portions are included.

> The absence of complete live deployment credentials and full source is intentional and expected for a production institutional system.

---

## Project Classification

| Attribute | Description |
|-----------|-------------|
| **Project Type** | Enterprise Campus IT Operations Platform |
| **Architecture** | Multi-tier, multi-platform, modular, role-based, security-hardened |
| **Platform Coverage** | Web SPA · Native Android (offline-capable) · Public Display Board + Walk-In Queue |
| **Primary Users** | Super Admins, Admins, Field Engineers |
| **Core Domain** | Device Management, IT Support, Event Coordination, Field Engineering, Asset Lifecycle, SLA Enforcement |
| **Development Scope** | End-to-End, Multi-Platform Software Engineering |
| **Deployment** | Campus LAN Production Environment (PM2 + Nginx + Blue-Green) |
| **Repository Purpose** | Technical Showcase / Engineering Case Study |
| **Source Code** | Proprietary / Selected samples only (full source not publicly exposed) |

---

## Technology Summary

| Category | Technologies |
|---|---|
| **Web Frontend** | `React 19`, `React DOM 19`, `React Router DOM 7`, `Vite 6`, `Tailwind CSS` |
| **Mobile** | `React Native 0.81.5`, `Expo SDK 54`, `TypeScript 5.9`, `Expo Router 6`, offline queue, camera, QR, biometric |
| **Backend** | `Node.js`, `Express.js 5` (modular: routes / middleware / services / controllers / jobs) |
| **Database** | `Supabase PostgreSQL` + RLS + Realtime + connection pooling |
| **Real-Time** | `Server-Sent Events (SSE)`, `Supabase Realtime WebSocket` |
| **Push** | `Firebase Admin SDK`, `Firebase Cloud Messaging`, `expo-notifications`, `@notifee/react-native` |
| **Security** | `JWT` + rotating refresh, MFA/TOTP, `bcryptjs`, Helmet.js, Zod, rate-limit, CORS whitelist, HTTPS/TLS, HSTS, session fingerprinting, RLS |
| **Communication** | `Nodemailer` + queue, custom HTML email templates |
| **PDF** | Custom pure-Node PDF engine with real Helvetica metrics |
| **Process & Proxy** | PM2 cluster, Nginx |
| **Observability** | Winston/Pino, Sentry, Uptime Kuma, `/health` endpoint |
| **Mobile HTTP** | `axios` |

---

## Final Perspective

The NSU IT Support Center is an example of engineering a **multi-platform operational software system** around real-world institutional requirements — not a demo application, but a production system used daily by IT staff to manage campus device support, event coordination, field engineering operations, asset lifecycle and SLA enforcement.

The system combines:

- Multi-platform architecture (web + offline-capable native mobile + display board)
- Modular professional backend architecture
- Role-based access control at API and UI layers
- Real-time synchronization via SSE and Supabase Realtime
- Native Android mobile application with push notifications, offline queue, camera, QR scanner and biometric gate
- Firebase FCM topic messaging for field engineer alerts
- Complex multi-stage device lifecycle workflows + Asset Registry
- AV event coordination with approval workflow, recurring events and personalized email dispatch
- Hardware lab diagnostic and repair tracking
- Custom PDF generation engine
- Monthly performance reporting with email delivery and leaderboard
- System-wide append-only audit logging
- Ticket presence, watchers and internal notes
- SLA timer engine with automatic escalation
- Hardened security (MFA, short-lived tokens, rate limiting, HTTPS, RLS, input validation)
- Zero-downtime deployment and comprehensive observability
- LAN production deployment

```mermaid
flowchart TD
    A[Real-World Requirement] --> B[System Architecture]
    B --> C[Multi-Platform Design]
    C --> D[Web · Mobile Offline · Display]
    D --> E[Real-Time Infrastructure]
    E --> F[Push Notifications]
    F --> G[Automated Communications]
    G --> H[PDF Reporting]
    H --> I[Security Hardening]
    I --> J[Modular Backend + Observability]
    J --> K[Production Deployment]
    K --> L[Operational Campus IT System]
```

> Engineered from real requirements.  
> Hardened for production.  
> Deployed across web and native mobile.  
> Serving live campus IT operations.

---

<div align="center">

*NSU IT Support Center — Enterprise Campus IT Operations Platform*

*Device Management · Campus Support · Field Engineering · Event Coordination · Lab Diagnostics · Asset Lifecycle · SLA Enforcement · Enterprise Security*

</div>
