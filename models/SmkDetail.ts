import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISmkDetail extends Document {
  BhaktId: number;
  SmkId: string;
  FirstName: string;
  MiddleName: string;
  LastName: string;
  FirstNameGuj: string;
  MiddleNameGuj: string;
  LastNameGuj: string;
  Gender: number;
  age: number;
  MobileNo: number;
  PresentVillageEng: string;
  PresentVillageGuj: string;
  NativeEng: string;
  NativeGuj: string;
  ZoneName: string;
  ZoneNameGuj: string;
  SubZoneName: string;
  SubZoneNameGuj: string;
  KutumbId: number;
}

const SmkDetailSchema: Schema<ISmkDetail> = new Schema(
  {
    BhaktId: { type: Number, required: true },
    SmkId: { type: String, required: true },
    FirstName: { type: String, required: true },
    MiddleName: { type: String },
    LastName: { type: String, required: true },
    FirstNameGuj: { type: String },
    MiddleNameGuj: { type: String },
    LastNameGuj: { type: String },
    Gender: { type: Number },
    age: { type: Number },
    MobileNo: { type: Number },
    PresentVillageEng: { type: String },
    PresentVillageGuj: { type: String },
    NativeEng: { type: String },
    NativeGuj: { type: String },
    ZoneName: { type: String },
    ZoneNameGuj: { type: String },
    SubZoneName: { type: String },
    SubZoneNameGuj: { type: String },
    KutumbId: { type: Number }
  },
  {
    timestamps: true,
    collection: "smkdetails"
  }
);

const SmkDetail: Model<ISmkDetail> =
  mongoose.models.smkdetails || mongoose.model<ISmkDetail>("smkdetails", SmkDetailSchema);

export default SmkDetail;
