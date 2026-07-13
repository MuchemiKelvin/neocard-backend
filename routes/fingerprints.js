const express = require("express");
const router = express.Router();

const database = require("../database");
const { authenticateDeviceApiKey } = require("../middleware");
const FingerprintValidation = require("../services/fingerprintValidation");

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