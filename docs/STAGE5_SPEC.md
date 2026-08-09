# NeoCampus Fingerprint Device — Stage 5 Development Brief

**Project:** NeoCampus Fingerprint Device / NeoCard Terminal  
**Stage:** Stage 5 — Final Device Completion & System Validation  
**MOU Date:** 24 July 2026  
**Client:** Nice Waardenburg  
**Developer:** Kelvin Muchemi  
**Budget:** €90 / 18 hours  

**Repositories:**

- `kdvc-fingerprint` — Raspberry Pi terminal application
- `neocard-backend` — Node.js/Express backend with SQLite

This document is the locked Stage 5 master specification. ChatGPT, Cursor, and the developer work from this contract. Do not redesign the architecture and do not add features outside this specification unless the client issues a new requirement/MOU.

---

## 1. Stage 5 Objective

Stage 5 is the final completion, validation, stabilization, documentation, and handover stage of the NeoCampus Fingerprint Device.

The objective is to take the functionality already developed in Stages 1–4 and turn it into a reliable, production-ready demonstration appliance that can:

- Boot independently.
- Initialize all hardware.
- Authenticate with the NeoCard backend.
- Display the user interface on the TFT.
- Enroll fingerprints.
- Verify registered fingerprints.
- Reject unknown fingerprints.
- Connect successful verification to NeoCard.
- Create a NeoCard check-in transaction.
- Continue operating through expected network/backend failures.
- Recover cleanly after reboot or connectivity restoration.
- Be fully tested, documented, demonstrated, and handed over to the client.

Stage 5 must not introduce unnecessary new product functionality.

---

## 2. Current System — Already Completed

Stages 1–4 have already established the core platform.

### Hardware

- Raspberry Pi Zero 2 W
- R503 fingerprint sensor
- TFT display
- Touch interface
- RTC
- Buzzer
- Power management

### Fingerprint

- Fingerprint enrollment
- Fingerprint template storage in R503
- Fingerprint matching on R503
- Fingerprint slot identification
- Fingerprint verification
- Unknown fingerprint handling

### Backend

- Device authentication
- Fingerprint verification API
- User/slot resolution
- NeoCard check-in API
- NeoCard transaction database
- Transaction UUID
- Idempotency
- Transaction status
- Verification method
- Transaction metadata

### Raspberry Pi Application

The application now uses a service-oriented architecture:

```
Application
    ↓
ServiceRegistry
    ↓
Services
    ↓
Drivers
    ↓
Hardware
```

The application also has a session/state machine and production UI foundation.

### Current successful flow

```
Raspberry Pi
     ↓
R503
     ↓
Fingerprint verification
     ↓
Backend
     ↓
User identified
     ↓
NeoCard check-in
     ↓
Transaction recorded
     ↓
TFT displays success
```

This has already been successfully demonstrated on the actual Raspberry Pi.

---

## 3. Stage 5 Scope

### A. Production Device Completion

The Raspberry Pi should behave as an independent appliance.

It should not require:

- `ssh`
- `source .venv/bin/activate`
- `python -m app.main`

for normal operation.

Implement:

- Automatic application startup using systemd.
- Application starts automatically after boot.
- Hardware initialization.
- Backend authentication.
- TFT-first user experience.
- Proper startup handling.
- Proper shutdown/restart handling.
- Reboot should return the device to a usable state.

The terminal/SSH console should be treated as a developer and diagnostic interface, not the normal user interface.

---

## 4. Reliability and Stability

The device must handle expected failures gracefully.

### Backend unavailable

Instead of crashing:

```
Backend unavailable
        ↓
Offline state
        ↓
Clear TFT feedback
        ↓
Retry connection
        ↓
Backend restored
        ↓
Return to normal operation
```

### Network interruption

The application should remain running and recover when connectivity returns.

### API timeout

Implement appropriate:

- Timeouts
- Retry behavior
- Error handling

Do not create infinite retry loops.

### Offline transactions

Where the existing SyncService supports it, failed check-in transactions should be retained locally and synchronized when connectivity returns.

This should be implemented carefully so that:

- Transactions aren't lost.
- Transactions aren't duplicated.
- UUID/idempotency remains intact.

---

## 5. Device Identity and Database Protection

This is an important Stage 5 requirement.

The device identity/API key must survive:

- Application restart
- Raspberry Pi reboot
- Backend restart

Testing must never accidentally wipe the live database or device registration.

Separate:

- Production/Demo data

from:

- Test data

where practical.

Document:

- Device registration
- Device ID
- API key configuration
- `.env` configuration
- Database location
- Backup procedure

Do not place actual secrets/passwords in public documentation or Git.

---

## 6. Final End-to-End Validation

The following workflow must be tested on the physical device.

### Test 1 — Boot

```
Power ON
 ↓
Linux
 ↓
NeoCard application
 ↓
Hardware initialization
 ↓
Backend authentication
 ↓
Home screen
```

Expected result: Device reaches ready state without SSH intervention.

### Test 2 — Enrollment

Verify that a new fingerprint can still be enrolled after the Stage 4 changes.

```
User registration
 ↓
Fingerprint enrollment
 ↓
Template stored
 ↓
Slot assigned
 ↓
Backend association
```

### Test 3 — Known Fingerprint

```
Place finger
 ↓
R503 matching
 ↓
Slot identified
 ↓
Backend resolves user
 ↓
User verified
 ↓
NeoCard check-in
 ↓
Transaction recorded
 ↓
TFT success
```

### Test 4 — Unknown Fingerprint

```
Unknown finger
 ↓
R503 search
 ↓
No matching template
 ↓
UNKNOWN
 ↓
Clear failure message
 ↓
Ready for next user
```

The device must not crash or become stuck.

### Test 5 — NeoCard Transaction

Verify:

- Correct user.
- Correct fingerprint slot.
- Correct device ID.
- Correct transaction type.
- Correct timestamp.
- UUID generated.
- Metadata stored.
- Transaction status correct.
- Dashboard/API reflects transaction.

### Test 6 — Duplicate Request

Send/retry the same transaction UUID.

Expected: One transaction — not two. This validates idempotency.

### Test 7 — Backend Failure

Stop the backend. Attempt normal operation.

Expected:

```
Device remains operational
        ↓
Offline/error state
        ↓
No crash
```

Restart backend.

Expected:

```
Reconnect
 ↓
Normal operation
```

### Test 8 — Reboot

```
sudo reboot
```

Expected:

```
Boot
 ↓
Application starts automatically
 ↓
Hardware initializes
 ↓
Backend connection
 ↓
Home
```

No manual intervention.

---

## 7. Bug Fixing

Fix only issues discovered during the validation process.

Potential areas include:

- Authentication failures
- API timeouts
- Database problems
- Duplicate transactions
- UI glitches
- Hardware initialization errors
- Reboot problems
- Network recovery
- Offline synchronization
- Excessive logging
- Application crashes

Do not redesign working architecture simply for the sake of redesigning it.

---

## 8. Performance Optimization

Perform focused optimization where it has measurable benefit.

Examples:

- Faster startup.
- Avoid unnecessary API calls.
- Avoid duplicate logging.
- Reduce unnecessary UI refreshes.
- Improve fingerprint verification loop.
- Improve API timeout/retry behavior.
- Prevent resource leaks.

Do not optimize prematurely.

---

## 9. Source Code Cleanup

After functionality is validated:

- Remove genuinely obsolete code.
- Remove unnecessary debug output.
- Remove unused imports.
- Organize configuration.
- Verify requirements.
- Update README.
- Keep useful hardware diagnostic scripts.
- Keep meaningful automated tests.
- Ensure both repositories contain the final working implementation.

No architecture rewrite.

---

## 10. Final Testing Documentation

Create a formal test report containing:

- Test ID
- Test Description
- Environment
- Procedure
- Expected Result
- Actual Result
- Pass/Fail
- Notes

Include the actual test results from the physical device.

The final report should prove that the system was tested rather than simply claiming that it works.

---

## 11. Final Demonstration Video

The video should demonstrate the real physical device.

Recommended sequence:

1. Power on device
2. Application starts automatically
3. Splash screen
4. Home screen
5. Unknown fingerprint → rejection
6. Registered fingerprint → verification
7. Welcome user
8. NeoCard check-in
9. Check-In Successful
10. Transaction visible in backend/dashboard
11. Return to ready state

The video should demonstrate the finished product, not development/debugging.

---

## 12. Final Technical Documentation

The handover documentation should contain at minimum:

- `README.md`
- `INSTALLATION.md`
- `SYSTEM_ARCHITECTURE.md`
- `API_REFERENCE.md`
- `HARDWARE_SETUP.md`
- `TEST_RESULTS.md`
- `TROUBLESHOOTING.md`
- `STAGE5_COMPLETION_REPORT.md`

Documentation should explain:

- System architecture.
- Hardware connections.
- Software installation.
- Environment configuration.
- Device registration.
- API configuration.
- Application startup.
- Fingerprint enrollment.
- Fingerprint verification.
- NeoCard transactions.
- Troubleshooting.
- Testing results.
- Maintenance instructions.

---

## 13. Handover Package

Final package:

```
NeoCampus-Fingerprint-Device/
│
├── kdvc-fingerprint/
│
├── neocard-backend/
│
├── Documentation/
│   ├── README
│   ├── Installation Guide
│   ├── Architecture
│   ├── API Reference
│   ├── Hardware Setup
│   ├── Troubleshooting
│   └── Stage 5 Completion Report
│
├── Test Results/
│
├── Demo Video/
│
├── Wiring Diagram/
│
└── Release Notes/
```

Source repositories should contain the final committed code.

---

## 14. Explicitly Out of Scope

Do not add the following as part of Stage 5 unless the client issues a new requirement/MOU:

- New admin UI
- Fleet management
- OTA firmware management
- Facial recognition
- NFC
- QR authentication
- New attendance product modes
- Cloud fleet monitoring
- Major database migration
- Multi-device management
- New product features unrelated to final validation

These can be future development stages.

---

## 15. Development Constraints

These rules are important.

**Rule 1 — No architecture redesign**  
Extend the existing architecture.

**Rule 2 — No unnecessary feature development**  
Stage 5 is completion, not expansion.

**Rule 3 — Test before fixing**  
Don't make speculative changes.

**Rule 4 — Preserve working functionality**

```
R503 matching
        ↓
/v1/fingerprints/verify
        ↓
user resolution
        ↓
/v1/neocard/checkin
        ↓
transaction
```

**Rule 5 — Physical hardware validation is mandatory**  
A feature isn't considered complete merely because its unit test passes. It must work on the actual Raspberry Pi where applicable.

**Rule 6 — Every production change gets regression-tested**

```
Fix
 ↓
Targeted test
 ↓
Full test suite
 ↓
Physical-device test where applicable
```

---

## 16. Stage 5 Definition of Done

Stage 5 is complete when:

```
Power ON
   ↓
Application starts automatically
   ↓
Hardware initializes
   ↓
Device authenticates
   ↓
Home screen
   ↓
Place finger
   ↓
R503 verifies
   ↓
Backend identifies user
   ↓
NeoCard transaction created
   ↓
TFT confirms transaction
   ↓
Device returns to ready state
```

and the device can:

- Reject unknown fingerprints.
- Enroll fingerprints.
- Handle expected network/backend failures.
- Recover from connectivity loss.
- Recover after reboot.
- Prevent duplicate transactions.
- Maintain its device identity.
- Operate without SSH intervention.
- Pass the final E2E test matrix.

Finally:

```
Source Code
     +
Tests
     +
Documentation
     +
Demo Video
     +
Handover Package
     ↓
CLIENT ACCEPTANCE
```

### Final objective

Deliver a stable, self-starting, fully integrated NeoCampus Fingerprint Terminal that demonstrates the complete fingerprint-to-NeoCard workflow reliably and is accompanied by the source code, test evidence, technical documentation, demonstration video, and handover materials required by the Stage 5 MOU.

---

## Recommended execution order

**Local-first (laptop integration lab), then one Pi deployment:**

1. Freeze current code  
2. Protect DB/device identity *(local complete; Pi credential sync at deploy)*  
3. Implement systemd auto-start *(prepare/test unit locally)*  
4. Implement/finish resilience and offline recovery  
5. Software E2E / regression (local)  
6. Fix discovered issues  
7. Source cleanup  
8. Documentation  
9. Stage 5 release candidate / tag  
10. Deploy to Raspberry Pi  
11. Physical E2E (R503/TFT/touch/buzzer/RTC/boot/systemd)  
12. Demo video  
13. Handover package  
14. Final Stage 5 release  

Physical Pi availability is **not** a blocker for Steps 2–9. It becomes required at Steps 10–12.

That is the complete Stage 5 scope. Nothing important from the MOU is being omitted, while we are deliberately avoiding unrelated new features.
