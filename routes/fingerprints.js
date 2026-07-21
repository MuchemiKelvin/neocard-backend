const express = require("express");
const router = express.Router();

const database = require("../database");
const { authenticateDeviceApiKey } = require("../middleware");
const FingerprintValidation = require("../services/fingerprintValidation");
const FingerprintVerification = require("../services/fingerprintVerification");

router.post("/enroll", authenticateDeviceApiKey, async (req, res) => {
  try {
    const {
      enrollment_id,
      user_id,
      device_id,
      fingerprint_slot,
      created_by,
      notes
    } = req.body;

    await FingerprintValidation.validateEnrollment(
      {
        enrollment_id,
        user_id,
        device_id,
        fingerprint_slot
      },
      req.device
    );

    const result = await database.createFingerprintEnrollment({
      enrollment_id,
      user_id,
      device_id,
      fingerprint_slot,
      created_by,
      notes
    });

    return res.status(201).json({
      success: true,
      message: "Fingerprint enrolled successfully.",
      data: result
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
      ...(error.code && { code: error.code })
    });
  }
});

/**
 * POST /v1/fingerprints/verify
 * Stage 3: resolve R503 slot match to NeoCard user (device API key).
 * Must be registered before /:enrollmentId.
 */
router.post("/verify", authenticateDeviceApiKey, async (req, res) => {
  try {
    const data = await FingerprintVerification.verify(req.body, req.device);

    return res.status(200).json({
      success: true,
      message: "Verification successful",
      data
    });
  } catch (error) {
    if (!error.status) {
      try {
        await FingerprintVerification.logAttempt({
          device_id: req.device?.device_id || req.body?.device_id,
          fingerprint_slot: req.body?.fingerprint_slot,
          confidence: req.body?.confidence,
          result: "ERROR"
        });
      } catch (logError) {
        console.error("Failed to write verification ERROR log:", logError);
      }
    }

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Verification failed",
      ...(error.code && { code: error.code })
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const data = await database.getAllFingerprintEnrollments(req.query);

    res.json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get("/:enrollmentId", async (req, res) => {
  try {
    const data = await database.getFingerprintEnrollment(
      req.params.enrollmentId
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found."
      });
    }

    res.json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.put("/:enrollmentId", async (req, res) => {
  try {
    const result = await database.updateFingerprintEnrollment(
      req.params.enrollmentId,
      req.body
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.delete("/:enrollmentId", async (req, res) => {
  try {
    const result = await database.deactivateFingerprintEnrollment(
      req.params.enrollmentId
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
