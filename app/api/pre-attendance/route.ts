import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/mongodb";
import PreAttendance from "@/models/PreAttendence";
import RavisabhaDetails from "@/models/RavisabhaDetails";
import SmkDetail from "@/models/SmkDetail";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * POST /api/pre-attendance
 *
 * Bulk-inserts pre-attendance records for a list of members.
 *
 * Body:
 * {
 *   members: [
 *     { smkDetailId: string, userId: string, SmkId: string, name: string }
 *   ]
 * }
 *
 * ravisabhaId is auto-resolved from the RavisabhaDetails record where
 * pre_attendance === true. Request is rejected if no such record exists.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const { members } = body as {
      members?: Array<{
        smkDetailId?: string;
        SmkId?: string;
        mehmanCount?: number;
        familyCount?: number;
        status?: "Present" | "Absent";
      }>;
    };

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { success: false, error: "Request body must include a non-empty `members` array." },
        { status: 400 }
      );
    }

    await connectDb();

    // Resolve the active Ravisabha where pre_attendance === true
    const activeRavisabha = await RavisabhaDetails.findOne({ pre_attendance: true })
      .select("_id date")
      .lean<{ _id: mongoose.Types.ObjectId; date: Date }>();

    if (!activeRavisabha) {
      return NextResponse.json(
        { success: false, error: "No active Ravisabha found." },
        { status: 404 }
      );
    }

    const ravisabhaId = activeRavisabha._id;

    // Separate members with smkDetailId (upsert) from counter-only records (always insert)
    const membersWithId = members.filter(m => m.smkDetailId);
    const counterOnlyMembers = members.filter(m => !m.smkDetailId);

    let insertedCount = 0;
    let updatedCount = 0;

    // Handle members with smkDetailId using bulkWrite with upsert
    if (membersWithId.length > 0) {
      const operations = membersWithId.map((m) => {
        const smkDetailObjectId = m.smkDetailId && mongoose.Types.ObjectId.isValid(m.smkDetailId)
          ? new mongoose.Types.ObjectId(m.smkDetailId)
          : m.smkDetailId;

        const mehman = typeof m.mehmanCount === "number" ? m.mehmanCount : Number(m.mehmanCount) || 0;
        const family = typeof m.familyCount === "number" ? m.familyCount : Number(m.familyCount) || 0;

        return {
          updateOne: {
            filter: {
              ravisabhaId,
              smkDetailId: smkDetailObjectId,
            },
            update: {
              $set: {
                ravisabhaId,
                smkDetailId: smkDetailObjectId,
                ...(m.SmkId ? { SmkId: m.SmkId } : {}),
                mehmanCount: mehman,
                familyCount: family,
                status: m.status || "Present",
              },
            },
            upsert: true, // Insert if doesn't exist, update if it does
          },
        };
      });

      const result = await PreAttendance.bulkWrite(operations, { ordered: false });
      insertedCount += result.upsertedCount;
      updatedCount += result.modifiedCount;
    }

    // Handle counter-only members (no smkDetailId) - insert each as a new document
    if (counterOnlyMembers.length > 0) {
      for (const m of counterOnlyMembers) {
        try {
          const doc = new PreAttendance({
            ravisabhaId,
            ...(m.SmkId ? { SmkId: m.SmkId } : {}),
            mehmanCount: typeof m.mehmanCount === "number" ? m.mehmanCount : Number(m.mehmanCount) || 0,
            familyCount: typeof m.familyCount === "number" ? m.familyCount : Number(m.familyCount) || 0,
            status: m.status || "Present",
          });
          await doc.save();
          insertedCount += 1;
          console.log("[pre-attendance] counter-only doc saved:", JSON.stringify({
            ravisabhaId: ravisabhaId.toString(),
            mehmanCount: doc.mehmanCount,
            familyCount: doc.familyCount,
            status: doc.status,
            _id: doc._id?.toString(),
          }));
        } catch (saveErr) {
          console.error("[pre-attendance] counter-only save failed:", saveErr);
          throw saveErr;
        }
      }
    }

    console.log("[pre-attendance] processed:", JSON.stringify({ 
      withId: membersWithId.length,
      counterOnly: counterOnlyMembers.length,
      inserted: insertedCount,
      updated: updatedCount
    }));

    return NextResponse.json(
      {
        success: true,
        message: "Pre-attendance recorded successfully.",
        ravisabhaId: ravisabhaId.toString(),
        ravisabhaDate: activeRavisabha.date,
        totalSubmitted: members.length,
        inserted: insertedCount,
        updated: updatedCount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[/api/pre-attendance] POST Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error. Please try again.";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pre-attendance
 *
 * Returns all pre-attendance entries for the currently active Ravisabha.
 *
 * Optional query param:
 *   ?mobile=9876543210  -> filter records by the member's mobile number
 *   ?smkDetailIds=id1,id2  -> filter records by specific smkDetailIds (comma-separated)
 */
export async function GET(request: NextRequest) {
  try {
    await connectDb();

    // Use _id (not a non-existent ravisabhaId field) when resolving the active ravisabha
    const activeRavisabha = await RavisabhaDetails.findOne({ pre_attendance: true })
      .select("_id date")
      .lean<{ _id: mongoose.Types.ObjectId; date: Date }>();

    if (!activeRavisabha) {
      return NextResponse.json(
        { success: false, error: "No active Ravisabha found." },
        { status: 404 }
      );
    }

    const ravisabhaId = activeRavisabha._id.toString();
    const { searchParams } = request.nextUrl;
    const mobileParam = searchParams.get("mobile");
    const smkDetailIdsParam = searchParams.get("smkDetailIds");

    // Filter by specific smkDetailIds (used by the toggle feature to check already-marked members)
    if (smkDetailIdsParam) {
      const ids = smkDetailIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ success: true, ravisabhaId, ravisabhaDate: activeRavisabha.date, total: 0, records: [] });
      }

      const records = await PreAttendance.find({
        ravisabhaId,
        smkDetailId: { $in: ids },
      }).lean();

      return NextResponse.json({
        success: true,
        ravisabhaId,
        ravisabhaDate: activeRavisabha.date,
        total: records.length,
        records,
      });
    }

    // Filter by mobile number — look up matching SmkDetail docs first
    if (mobileParam) {
      const trimmed = mobileParam.trim();
      if (!/^\d{10}$/.test(trimmed)) {
        return NextResponse.json(
          { success: false, error: "Invalid mobile number. Must be exactly 10 digits." },
          { status: 400 }
        );
      }

      const smkDocs = await SmkDetail.find(
        { MobileNo: Number(trimmed) },
        { _id: 1 }
      ).lean<{ _id: mongoose.Types.ObjectId }[]>();

      const smkIds = smkDocs.map((d) => d._id.toString());

      const records = await PreAttendance.find({
        ravisabhaId,
        smkDetailId: { $in: smkIds },
      }).lean();

      return NextResponse.json({
        success: true,
        ravisabhaId,
        ravisabhaDate: activeRavisabha.date,
        total: records.length,
        records,
      });
    }

    // No filter — return all records for the active Ravisabha
    const records = await PreAttendance.find({ ravisabhaId }).lean();

    return NextResponse.json({
      success: true,
      ravisabhaId,
      ravisabhaDate: activeRavisabha.date,
      total: records.length,
      records,
    });
  } catch (error) {
    console.error("[/api/pre-attendance] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pre-attendance
 *
 * Updates the mehmanCount and/or familyCount on an existing pre-attendance record.
 * Used when the first (searched) member is already marked present and the counters change.
 *
 * Body:
 * {
 *   smkDetailId: string,
 *   mehmanCount: number,
 *   familyCount: number
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const { smkDetailId, mehmanCount, familyCount } = body as {
      smkDetailId?: string;
      mehmanCount?: number;
      familyCount?: number;
    };

    if (!smkDetailId) {
      return NextResponse.json(
        { success: false, error: "smkDetailId is required." },
        { status: 400 }
      );
    }

    if (typeof mehmanCount !== "number" || mehmanCount < 0) {
      return NextResponse.json(
        { success: false, error: "mehmanCount must be a non-negative number." },
        { status: 400 }
      );
    }

    if (typeof familyCount !== "number" || familyCount < 0) {
      return NextResponse.json(
        { success: false, error: "familyCount must be a non-negative number." },
        { status: 400 }
      );
    }

    await connectDb();

    const activeRavisabha = await RavisabhaDetails.findOne({ pre_attendance: true })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId }>();

    if (!activeRavisabha) {
      return NextResponse.json(
        { success: false, error: "No active Ravisabha found." },
        { status: 404 }
      );
    }

    const ravisabhaId = activeRavisabha._id.toString();

    const updated = await PreAttendance.findOneAndUpdate(
      { ravisabhaId, smkDetailId },
      { $set: { mehmanCount, familyCount } },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Attendance record not found for this member." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      smkDetailId,
      mehmanCount: updated.mehmanCount,
    });
  } catch (error) {
    console.error("[/api/pre-attendance] PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pre-attendance
 *
 * Removes pre-attendance records for the given smkDetailIds under the active Ravisabha.
 * Used when a user unchecks a member who was already marked present.
 *
 * Body:
 * {
 *   smkDetailIds: string[]
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const { smkDetailIds } = body as { smkDetailIds?: string[] };

    if (!Array.isArray(smkDetailIds) || smkDetailIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Request body must include a non-empty `smkDetailIds` array." },
        { status: 400 }
      );
    }

    await connectDb();

    const activeRavisabha = await RavisabhaDetails.findOne({ pre_attendance: true })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId }>();

    if (!activeRavisabha) {
      return NextResponse.json(
        { success: false, error: "No active Ravisabha found." },
        { status: 404 }
      );
    }

    const ravisabhaId = activeRavisabha._id.toString();

    const result = await PreAttendance.deleteMany({
      ravisabhaId,
      smkDetailId: { $in: smkDetailIds },
    });

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
      ravisabhaId,
    });
  } catch (error) {
    console.error("[/api/pre-attendance] DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}
