import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/mongodb";
import SmkDetail from "@/models/SmkDetail";

export const dynamic = "force-dynamic";

interface SmkDoc {
  _id?: { toString(): string } | string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
  MobileNo?: number;
  SmkId?: string;
  FirstNameGuj?: string;
  MiddleNameGuj?: string;
  LastNameGuj?: string;
  Gender?: number;
  KutumbId?: number;
  ZoneName?: string;
  ZoneNameGuj?: string;
  SubZoneName?: string;
  SubZoneNameGuj?: string;
  PresentVillageEng?: string;
  PresentVillageGuj?: string;
  AddressDescription?: string;
  FamilyLeaderNameEng?: string;
  FamilyLeaderNameGuj?: string;
}

/** Map a Mongoose document to the frontend User shape */
function formatUser(doc: SmkDoc) {
  const firstName = doc.FirstName || "";
  const middleName = doc.MiddleName || "";
  const lastName = doc.LastName || "";
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const firstNameGuj = doc.FirstNameGuj || "";
  const middleNameGuj = doc.MiddleNameGuj || "";
  const lastNameGuj = doc.LastNameGuj || "";
  const gujaratiFullName = [firstNameGuj, middleNameGuj, lastNameGuj]
    .filter(Boolean)
    .join(" ");
  const mobileStr =
    doc.MobileNo !== undefined && doc.MobileNo !== null
      ? String(doc.MobileNo)
      : "";

  return {
    id: doc._id ? doc._id.toString() : "",
    name: fullName,
    mobileNumber: mobileStr,
    mobileNo: mobileStr,
    smkNo: doc.SmkId || "",
    firstName,
    middleName,
    lastName,
    firstNameGuj,
    middleNameGuj,
    lastNameGuj,
    gujaratiName: gujaratiFullName,
    gender: doc.Gender !== undefined && doc.Gender !== null ? String(doc.Gender) : "",
    zone: doc.ZoneName || "",
    subZone: doc.SubZoneName || "",
    village: doc.PresentVillageEng || "",
    kutumbId: doc.KutumbId ?? null,
    addressDescription: doc.AddressDescription || "",
    familyLeaderNameEng: doc.FamilyLeaderNameEng || "",
    familyLeaderNameGuj: doc.FamilyLeaderNameGuj || "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // ── Mode A1: Direct KutumbId query ──
    const kutumbParam = searchParams.get("kutumbId");
    if (kutumbParam !== null && kutumbParam.trim()) {
      const kId = Number(kutumbParam.trim());
      if (!isNaN(kId) && kId > 0) {
        await connectDb();
        const docs = await SmkDetail.find(
          { KutumbId: kId },
          {
            FirstName: 1,
            MiddleName: 1,
            LastName: 1,
            FirstNameGuj: 1,
            MiddleNameGuj: 1,
            LastNameGuj: 1,
            MobileNo: 1,
            SmkId: 1,
            Gender: 1,
            KutumbId: 1,
            ZoneName: 1,
            ZoneNameGuj: 1,
            SubZoneName: 1,
            SubZoneNameGuj: 1,
            PresentVillageEng: 1,
            PresentVillageGuj: 1,
            AddressDescription: 1,
            FamilyLeaderNameEng: 1,
            FamilyLeaderNameGuj: 1,
          }
        )
          .sort({ FirstName: 1 })
          .lean<SmkDoc[]>();

        return NextResponse.json({ users: docs.map(formatUser) });
      }
    }

    // ── Mode A2: Mobile number selection → fetch ALL members with that MobileNo / KutumbId ──
    // ?mobile=9876543210
    const mobileParam = searchParams.get("mobile");
    if (mobileParam !== null) {
      const trimmed = mobileParam.trim();

      if (!/^\d{10}$/.test(trimmed)) {
        return NextResponse.json(
          { error: "Invalid mobile number. Must be exactly 10 digits." },
          { status: 400 }
        );
      }

      await connectDb();
      const projection = {
        FirstName: 1,
        MiddleName: 1,
        LastName: 1,
        FirstNameGuj: 1,
        MiddleNameGuj: 1,
        LastNameGuj: 1,
        MobileNo: 1,
        SmkId: 1,
        Gender: 1,
        KutumbId: 1,
        ZoneName: 1,
        ZoneNameGuj: 1,
        SubZoneName: 1,
        SubZoneNameGuj: 1,
        PresentVillageEng: 1,
        PresentVillageGuj: 1,
        AddressDescription: 1,
        FamilyLeaderNameEng: 1,
        FamilyLeaderNameGuj: 1,
      };

      const matchedByMobile = await SmkDetail.find(
        { MobileNo: Number(trimmed) },
        projection
      ).lean<SmkDoc[]>();

      const targetKutumbId = matchedByMobile.find(
        (d) => d.KutumbId !== undefined && d.KutumbId !== null && d.KutumbId > 0
      )?.KutumbId;

      let docs: SmkDoc[] = [];
      if (targetKutumbId) {
        docs = await SmkDetail.find(
          { KutumbId: targetKutumbId },
          projection
        )
          .sort({ FirstName: 1 })
          .lean<SmkDoc[]>();
      } else {
        docs = matchedByMobile;
      }

      return NextResponse.json({ users: docs.map(formatUser) });
    }

    // ── Mode B: Type-ahead prefix search — used while user is typing ──
    // ?query=987  → return up to 10 distinct mobile numbers that start with "987"
    const queryParam = searchParams.get("query");
    if (!queryParam || !queryParam.trim()) {
      return NextResponse.json({ users: [] });
    }

    const prefix = queryParam.trim();

    // Only accept numeric input for mobile search
    if (!/^\d+$/.test(prefix)) {
      return NextResponse.json(
        { error: "Query must contain digits only for mobile number search." },
        { status: 400 }
      );
    }

    // Max 10 digits
    if (prefix.length > 10) {
      return NextResponse.json({ users: [] });
    }

    await connectDb();

    // Match any mobile number containing the searched digits (substring match)
    const docs = await SmkDetail.aggregate<SmkDoc>([
      {
        $addFields: {
          mobileStr: { $toString: "$MobileNo" },
        },
      },
      {
        $match: {
          mobileStr: { $regex: prefix },
        },
      },
      {
        $sort: { MobileNo: 1, FirstName: 1 },
      },
      {
        $limit: 20,
      },
      {
        $project: {
          FirstName: 1,
          MiddleName: 1,
          LastName: 1,
          FirstNameGuj: 1,
          MiddleNameGuj: 1,
          LastNameGuj: 1,
          MobileNo: 1,
          SmkId: 1,
          Gender: 1,
          KutumbId: 1,
          ZoneName: 1,
          SubZoneName: 1,
          PresentVillageEng: 1,
          AddressDescription: 1,
          FamilyLeaderNameEng: 1,
          FamilyLeaderNameGuj: 1,
        },
      },
    ]);

    return NextResponse.json({ users: docs.map(formatUser) });
  } catch (error) {
    console.error("[/api/search] Error:", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}
