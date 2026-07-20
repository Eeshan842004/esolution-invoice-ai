import { getInvoiceById } from "@/lib/sheets";
import { notFound } from "next/navigation";
import PaymentClient from "./PaymentClient";

export const metadata = {
    title: "Secure Payment - ESolution",
    description: "Pay your invoice securely via ESolution Pay",
};

export default async function PayPage({ params }) {
    const { id } = await params;
    const invoice = await getInvoiceById(id);

    if (!invoice) {
        notFound();
    }

    return <PaymentClient invoice={invoice} />;
}
