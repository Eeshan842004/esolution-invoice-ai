import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        message: "Endpoints moved to /api/invoices/list (GET) and /api/invoices/create (POST)"
    });
}

export async function POST() {
    return NextResponse.json({
        message: "Endpoints moved to /api/invoices/list (GET) and /api/invoices/create (POST)"
    });
}
