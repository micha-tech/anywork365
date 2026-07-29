from pathlib import Path
from textwrap import wrap

from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "anywork365-wallet-payment-architecture.pdf"
LOGO = ROOT / "public" / "anyworks-logo.png"

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
TOP = 19 * mm
BOTTOM = 16 * mm

BRAND = colors.HexColor("#0F4F4A")
BRAND_2 = colors.HexColor("#1F6F68")
TEAL_LIGHT = colors.HexColor("#DFF0F0")
TEAL_PALE = colors.HexColor("#F0F9F9")
INK = colors.HexColor("#17212B")
SLATE = colors.HexColor("#52606D")
MUTED = colors.HexColor("#718096")
LINE_COLOR = colors.HexColor("#D9E2E8")
SURFACE = colors.HexColor("#F6F8FA")
AMBER = colors.HexColor("#D97706")
AMBER_PALE = colors.HexColor("#FFF7E8")
GREEN = colors.HexColor("#16794A")
GREEN_PALE = colors.HexColor("#EAF7F0")
RED = colors.HexColor("#B42318")
RED_PALE = colors.HexColor("#FDECEC")
WHITE = colors.white


def register_fonts():
    candidates = [
        (
            Path("C:/Windows/Fonts/arial.ttf"),
            Path("C:/Windows/Fonts/arialbd.ttf"),
        ),
        (
            Path("C:/Windows/Fonts/segoeui.ttf"),
            Path("C:/Windows/Fonts/segoeuib.ttf"),
        ),
    ]
    for regular, bold in candidates:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont("AWBody", str(regular)))
            pdfmetrics.registerFont(TTFont("AWBold", str(bold)))
            return "AWBody", "AWBold"
    return "Helvetica", "Helvetica-Bold"


BODY_FONT, BOLD_FONT = register_fonts()


class ArchitectureDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=MARGIN_X,
            rightMargin=MARGIN_X,
            topMargin=TOP,
            bottomMargin=BOTTOM,
            title="Anywork365 Wallet, Locked-Funds Release and Payment Architecture",
            author="Anywork365",
            subject="Marketplace wallet, payment, earnings release and withdrawal architecture",
        )
        frame = Frame(
            MARGIN_X,
            BOTTOM,
            PAGE_W - 2 * MARGIN_X,
            PAGE_H - TOP - BOTTOM,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates(
            [
                PageTemplate(id="main", frames=[frame], onPage=page_chrome),
            ]
        )


def page_chrome(canvas, doc):
    page = canvas.getPageNumber()
    canvas.saveState()
    if page > 1:
        canvas.setFillColor(BRAND)
        canvas.rect(0, PAGE_H - 7 * mm, PAGE_W, 7 * mm, fill=1, stroke=0)
        canvas.setFillColor(SLATE)
        canvas.setFont(BODY_FONT, 7.5)
        canvas.drawString(MARGIN_X, 8 * mm, "ANYWORK365  /  FINANCIAL ARCHITECTURE")
        canvas.drawRightString(PAGE_W - MARGIN_X, 8 * mm, f"PAGE {page}")
        canvas.setStrokeColor(LINE_COLOR)
        canvas.line(MARGIN_X, 11 * mm, PAGE_W - MARGIN_X, 11 * mm)
    canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        "CoverKicker",
        fontName=BOLD_FONT,
        fontSize=10,
        leading=12,
        textColor=BRAND_2,
        spaceAfter=10,
        uppercase=True,
    )
)
styles.add(
    ParagraphStyle(
        "CoverTitle",
        fontName=BOLD_FONT,
        fontSize=29,
        leading=33,
        textColor=INK,
        spaceAfter=14,
    )
)
styles.add(
    ParagraphStyle(
        "CoverSubtitle",
        fontName=BODY_FONT,
        fontSize=12.5,
        leading=18,
        textColor=SLATE,
        spaceAfter=18,
    )
)
styles.add(
    ParagraphStyle(
        "SectionKicker",
        fontName=BOLD_FONT,
        fontSize=8.5,
        leading=10,
        textColor=BRAND_2,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        "H1x",
        fontName=BOLD_FONT,
        fontSize=21,
        leading=25,
        textColor=INK,
        spaceAfter=9,
    )
)
styles.add(
    ParagraphStyle(
        "H2x",
        fontName=BOLD_FONT,
        fontSize=13,
        leading=16,
        textColor=BRAND,
        spaceBefore=8,
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        "Bodyx",
        fontName=BODY_FONT,
        fontSize=9.4,
        leading=13.6,
        textColor=INK,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        "Smallx",
        fontName=BODY_FONT,
        fontSize=7.8,
        leading=10.5,
        textColor=SLATE,
    )
)
styles.add(
    ParagraphStyle(
        "Tinyx",
        fontName=BODY_FONT,
        fontSize=6.8,
        leading=8.4,
        textColor=SLATE,
    )
)
styles.add(
    ParagraphStyle(
        "Bulletx",
        fontName=BODY_FONT,
        fontSize=9,
        leading=12.5,
        textColor=INK,
        leftIndent=12,
        firstLineIndent=-7,
        bulletIndent=0,
        spaceAfter=3.5,
    )
)
styles.add(
    ParagraphStyle(
        "BoxTitle",
        fontName=BOLD_FONT,
        fontSize=9.5,
        leading=12,
        textColor=BRAND,
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        "BoxBody",
        fontName=BODY_FONT,
        fontSize=8.2,
        leading=11.2,
        textColor=INK,
    )
)
styles.add(
    ParagraphStyle(
        "TableHead",
        fontName=BOLD_FONT,
        fontSize=7.5,
        leading=9,
        textColor=WHITE,
        alignment=TA_LEFT,
    )
)
styles.add(
    ParagraphStyle(
        "TableCell",
        fontName=BODY_FONT,
        fontSize=7.2,
        leading=9.2,
        textColor=INK,
    )
)
styles.add(
    ParagraphStyle(
        "CenterSmall",
        fontName=BODY_FONT,
        fontSize=7.2,
        leading=9,
        textColor=INK,
        alignment=TA_CENTER,
    )
)


def p(text, style="Bodyx"):
    return Paragraph(text, styles[style])


def bullet(text):
    return Paragraph(f"- {text}", styles["Bulletx"])


def section_header(number, title, subtitle=None):
    items = [
        Paragraph(f"ARCHITECTURE  /  {number:02d}", styles["SectionKicker"]),
        Paragraph(title, styles["H1x"]),
    ]
    if subtitle:
        items.append(Paragraph(subtitle, styles["Bodyx"]))
    items.append(Spacer(1, 3 * mm))
    return items


def callout(title, text, tone="teal"):
    palette = {
        "teal": (TEAL_PALE, BRAND),
        "amber": (AMBER_PALE, AMBER),
        "red": (RED_PALE, RED),
        "green": (GREEN_PALE, GREEN),
    }
    background, accent = palette[tone]
    table = Table(
        [[p(title, "BoxTitle"), p(text, "BoxBody")]],
        colWidths=[43 * mm, 125 * mm],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.7, accent),
                ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def info_cards(cards, cols=3):
    rows = []
    for idx in range(0, len(cards), cols):
        row = []
        for title, body in cards[idx : idx + cols]:
            row.append(
                [
                    p(title, "BoxTitle"),
                    Spacer(1, 1.5 * mm),
                    p(body, "BoxBody"),
                ]
            )
        while len(row) < cols:
            row.append("")
        rows.append(row)
    table = Table(rows, colWidths=[168 * mm / cols] * cols, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def table_block(headers, rows, widths):
    data = [[p(x, "TableHead") for x in headers]]
    for row in rows:
        data.append([p(str(x), "TableCell") for x in row])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE_COLOR),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for idx in range(1, len(data)):
        if idx % 2 == 0:
            style.append(("BACKGROUND", (0, idx), (-1, idx), TEAL_PALE))
    table.setStyle(TableStyle(style))
    return table


def flow_strip(labels, width=168 * mm, height=31 * mm, accent_index=None):
    drawing = Drawing(width, height)
    count = len(labels)
    gap = 5 * mm
    box_w = (width - gap * (count - 1)) / count
    box_h = 20 * mm
    y = 5.5 * mm
    for i, label in enumerate(labels):
        x = i * (box_w + gap)
        fill = TEAL_LIGHT if i != accent_index else colors.HexColor("#B8E0E0")
        drawing.add(Rect(x, y, box_w, box_h, rx=5, ry=5, fillColor=fill, strokeColor=BRAND_2, strokeWidth=0.8))
        # Keep labels comfortably inside narrow boxes. The previous character
        # estimate was too generous for seven-step flows and let text touch the
        # connector arrows.
        lines = wrap(label, width=max(8, int(box_w / mm * 0.75)))
        line_height = 7.2
        total = len(lines) * line_height
        start_y = y + box_h / 2 + total / 2 - 6.4
        for line_idx, line in enumerate(lines):
            drawing.add(
                String(
                    x + box_w / 2,
                    start_y - line_idx * line_height,
                    line,
                    fontName=BOLD_FONT if i == accent_index else BODY_FONT,
                    fontSize=6.8,
                    textAnchor="middle",
                    fillColor=INK,
                )
            )
        if i < count - 1:
            x1 = x + box_w
            x2 = x1 + gap - 1.5 * mm
            mid = y + box_h / 2
            drawing.add(Line(x1 + 1 * mm, mid, x2, mid, strokeColor=BRAND_2, strokeWidth=1.3))
            drawing.add(
                Polygon(
                    [x2, mid, x2 - 2.2 * mm, mid + 1.5 * mm, x2 - 2.2 * mm, mid - 1.5 * mm],
                    fillColor=BRAND_2,
                    strokeColor=BRAND_2,
                )
            )
    return drawing


def split_flow(left_labels, right_labels, width=168 * mm, height=73 * mm):
    drawing = Drawing(width, height)
    column_w = 76 * mm
    gap_x = 16 * mm
    for side, labels in enumerate([left_labels, right_labels]):
        x = side * (column_w + gap_x)
        drawing.add(
            String(
                x,
                height - 6 * mm,
                "SUCCESS PATH" if side == 0 else "EXCEPTION PATH",
                fontName=BOLD_FONT,
                fontSize=8,
                fillColor=GREEN if side == 0 else AMBER,
            )
        )
        box_h = 11 * mm
        y = height - 20 * mm
        for idx, label in enumerate(labels):
            tone = GREEN_PALE if side == 0 else AMBER_PALE
            edge = GREEN if side == 0 else AMBER
            drawing.add(Rect(x, y, column_w, box_h, rx=4, ry=4, fillColor=tone, strokeColor=edge, strokeWidth=0.8))
            drawing.add(String(x + 4 * mm, y + 4.2 * mm, label, fontName=BODY_FONT, fontSize=7.4, fillColor=INK))
            if idx < len(labels) - 1:
                mid = x + column_w / 2
                drawing.add(Line(mid, y, mid, y - 4 * mm, strokeColor=edge, strokeWidth=1))
            y -= 15 * mm
    return drawing


def cover():
    content = [Spacer(1, 10 * mm)]
    if LOGO.exists():
        logo = Image(str(LOGO), width=39 * mm, height=39 * mm)
        content.extend([logo, Spacer(1, 9 * mm)])
    content.extend(
        [
            p("ANYWORK365  /  FINANCIAL SYSTEMS", "CoverKicker"),
            p("Wallet, Internal Locked-Funds Release & Payment Architecture", "CoverTitle"),
            p(
                "A production architecture for booking-specific Paystack collections, "
                "immutable internal accounting, artisan earnings release, refunds, "
                "withdrawals, disputes and financial operations.",
                "CoverSubtitle",
            ),
            Spacer(1, 6 * mm),
            callout(
                "TERMINOLOGY",
                "The product uses <b>locked job funds</b>, <b>pending earnings</b> and "
                "<b>available earnings</b>. This is the internal mechanism the team has "
                "informally called escrow; the document does not make a regulated custody claim.",
                "teal",
            ),
            Spacer(1, 8 * mm),
            info_cards(
                [
                    ("RAIL", "Paystack for external payment collection, refunds and bank transfers."),
                    ("SOURCE OF TRUTH", "Anywork365's immutable, balanced internal ledger."),
                    ("CURRENCY", "NGN only, recorded as integer kobo - never floating point."),
                ]
            ),
            Spacer(1, 20 * mm),
            p("<b>Document version:</b> 1.0  |  <b>Date:</b> 28 July 2026", "Smallx"),
            p(
                "<b>Implementation status:</b> Built behind a disabled v3 feature flag. "
                "Staging validation and production approval remain required.",
                "Smallx",
            ),
        ]
    )
    return content


def build_story():
    story = []
    story.extend(cover())
    story.append(PageBreak())

    story.extend(
        section_header(
            1,
            "Executive architecture",
            "The wallet is a marketplace accounting view, not an unrestricted stored-value or user-to-user transfer product.",
        )
    )
    story.append(
        flow_strip(
            [
                "Client booking",
                "Paystack collection",
                "Locked job funds",
                "Pending earnings",
                "Available earnings",
                "Paystack withdrawal",
            ],
            accent_index=2,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        info_cards(
            [
                (
                    "Booking-specific collection",
                    "The server creates the booking and exact payment amount before Paystack initialization. There is no general top-up.",
                ),
                (
                    "Availability states",
                    "Locked, pending, held and withdrawal-pending money cannot be spent or withdrawn.",
                ),
                (
                    "One ledger boundary",
                    "Only LedgerService may post financial entries or update account projections.",
                ),
                (
                    "Provider verification",
                    "Amount, currency, environment, customer email and booking metadata must all match.",
                ),
                (
                    "Safe external calls",
                    "A durable intent or reservation commits before any Paystack network request.",
                ),
                (
                    "Operationally reconcilable",
                    "Provider events, audit logs, outbox records and internal references provide end-to-end traceability.",
                ),
            ],
            cols=3,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        callout(
            "NON-NEGOTIABLE BOUNDARY",
            "Clients cannot send arbitrary cash-like value to artisans. Money reaches an artisan only through a funded booking and an authorized release event.",
            "amber",
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("System roles", "H2x"))
    story.append(
        table_block(
            ["Role", "Financial responsibility", "Explicit restriction"],
            [
                ("Client", "Creates and pays for a booking; confirms completion.", "Cannot transfer arbitrary value to another user."),
                ("Artisan", "Accepts a funded booking; receives held earnings.", "Cannot withdraw pending, held or disputed earnings."),
                ("Paystack", "External collection, refund and bank-transfer rail.", "Does not define internal spendability or booking state."),
                ("Finance admin", "Approves exceptions and reconciliation with scoped permission.", "Cannot directly edit account balances or posted entries."),
                ("Support", "Views user progress and transaction context.", "No financial mutation or finance permission."),
            ],
            [24 * mm, 76 * mm, 68 * mm],
        )
    )
    story.append(PageBreak())

    story.extend(
        section_header(
            2,
            "Payment collection architecture",
            "A payment intent is authoritative because it is created from the server-side booking, not from an amount supplied to a wallet top-up endpoint.",
        )
    )
    story.append(
        flow_strip(
            [
                "Create booking",
                "Commit payment intent",
                "Initialize Paystack",
                "Signed charge event",
                "Verify with Paystack",
                "Post locked funds",
            ],
            accent_index=4,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Successful collection sequence", "H2x"))
    for item in [
        "<b>1.</b> The server validates the client, artisan, booking description, date and exact NGN price.",
        "<b>2.</b> One transaction commits the booking, job-funds record, versioned fee rule and unique payment intent.",
        "<b>3.</b> Paystack is initialized only after that commit, using the same reference, amount and booking metadata.",
        "<b>4.</b> The callback improves user experience; signed webhooks provide the durable asynchronous confirmation path.",
        "<b>5.</b> Verification must return SUCCESS and match reference, amount, NGN, environment, customer email, booking ID and client UID.",
        "<b>6.</b> One idempotent journal moves external payment clearing into the booking's locked-funds account.",
    ]:
        story.append(p(item, "Bodyx"))
    story.append(Spacer(1, 3 * mm))
    story.append(
        table_block(
            ["Collection journal", "Signed amount", "Meaning"],
            [
                ("External payment clearing", "- NGN 100,000.00", "Provider collection recognized by the internal system."),
                ("Booking locked job funds", "+ NGN 100,000.00", "Client funds become non-spendable and tied to this booking."),
                ("Journal total", "NGN 0.00", "Required invariant for every posted transaction."),
            ],
            [58 * mm, 37 * mm, 73 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        callout(
            "LATE PAYMENT AFTER CANCELLATION",
            "If cancellation is requested while Paystack is still processing, the job enters CANCEL_REQUESTED. A later successful payment is still verified and posted, then immediately reserved for refund. It is never orphaned.",
            "amber",
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        info_cards(
            [
                ("Duplicate webhook", "Unique event hash plus posting idempotency returns the existing result."),
                ("Changed replay", "Reusing an idempotency key with different parameters returns a conflict."),
                ("Unknown provider result", "No internal credit is posted until Paystack verification succeeds."),
            ]
        )
    )
    story.append(PageBreak())

    story.extend(
        section_header(
            3,
            "Internal locked-funds release",
            "Completion never credits an immediately withdrawable balance. It first creates pending artisan earnings and recognizes the versioned platform commission.",
        )
    )
    story.append(
        flow_strip(
            [
                "Funded booking",
                "Artisan confirms",
                "Work completes",
                "Client authorizes release",
                "Pending earnings",
                "Timed hold matures",
                "Available earnings",
            ],
            accent_index=4,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Release authorization and locking", "H2x"))
    story.append(
        info_cards(
            [
                ("Authorization", "Only the paying client may mark a confirmed booking complete."),
                ("Concurrency", "The booking and job-funds rows are locked before checking release state."),
                ("Exactly once", "The release idempotency key is derived from the immutable job-funds record."),
                ("Fee traceability", "The fee rule version and calculated amount were fixed when funding was created."),
            ],
            cols=2,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        table_block(
            ["Release journal example", "Signed amount", "Availability after posting"],
            [
                ("Booking locked job funds", "- NGN 100,000.00", "Booking account returns to zero."),
                ("Artisan pending earnings", "+ NGN 95,000.00", "Not withdrawable during the safety hold."),
                ("Platform commission revenue", "+ NGN 5,000.00", "Versioned 500-basis-point example."),
                ("Journal total", "NGN 0.00", "Balanced before commit."),
            ],
            [59 * mm, 37 * mm, 72 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        callout(
            "HOLD RELEASE",
            "A protected worker selects matured holds with row locks and SKIP LOCKED. It posts pending earnings to available earnings exactly once, then emits a notification through the transactional outbox.",
            "green",
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("State progression", "H2x"))
    story.append(
        table_block(
            ["State", "Can be spent?", "Can be withdrawn?", "Exit condition"],
            [
                ("LOCKED JOB FUNDS", "No", "No", "Authorized completion or refund decision."),
                ("PENDING EARNINGS", "No", "No", "Safety hold matures without dispute."),
                ("RISK HOLD", "No", "No", "Finance or dispute outcome."),
                ("AVAILABLE EARNINGS", "No P2P", "Yes", "Withdrawal reservation."),
                ("WITHDRAWAL PENDING", "No", "No", "Verified provider terminal status."),
            ],
            [39 * mm, 27 * mm, 31 * mm, 71 * mm],
        )
    )
    story.append(PageBreak())

    story.extend(
        section_header(
            4,
            "Ledger and account architecture",
            "The journal is the source of truth. Cached account balances exist only as row-locked projections and are continuously reconciled.",
        )
    )
    story.append(
        flow_strip(
            [
                "Domain command",
                "Validate state",
                "Lock accounts",
                "Balanced transaction",
                "Immutable entries",
                "Audit + outbox",
            ],
            accent_index=3,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Core invariants", "H2x"))
    story.append(
        info_cards(
            [
                ("At least two accounts", "A posted business event cannot contain a one-sided entry."),
                ("Zero-sum by currency", "All consolidated NGN entry deltas must sum to exactly zero."),
                ("Integer minor units", "Application calculations use bigint and database amounts use BIGINT kobo."),
                ("Immutable posting", "Database triggers block UPDATE and DELETE on posted transactions and entries."),
                ("Nonnegative protection", "User, booking and revenue accounts cannot cross below zero unless explicitly allowed."),
                ("Compensating corrections", "Errors are reversed by a new linked event; history is never rewritten."),
            ]
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Account families", "H2x"))
    story.append(
        table_block(
            ["Owner", "Representative accounts", "Classification / policy"],
            [
                ("Client", "Available marketplace funds; locked job funds; refund pending; refundable funds", "LIABILITY; nonnegative"),
                ("Artisan", "Pending; available; withdrawal pending; withdrawn; reversed; reserve hold", "LIABILITY; nonnegative"),
                ("Platform", "Commission; transaction fee; refund/chargeback liability; operational reserve", "REVENUE, LIABILITY or ASSET"),
                ("System", "External payment/transfer clearing; suspense; opening balance; adjustment", "CLEARING, SUSPENSE or EQUITY; explicitly controlled"),
            ],
            [25 * mm, 92 * mm, 51 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        callout(
            "ACCOUNT CREATION",
            "Public APIs cannot create arbitrary financial accounts. Account construction is allow-listed in the internal account registry and always fixes owner, purpose, classification, currency and negative-balance policy.",
            "teal",
        )
    )
    story.append(PageBreak())

    story.extend(
        section_header(
            5,
            "Artisan withdrawals and money movement",
            "Funding and withdrawals use Paystack; internal booking release remains an internal ledger movement. Available earnings are the only withdrawable balance.",
        )
    )
    story.append(
        split_flow(
            [
                "Available earnings",
                "KYC + verified recipient",
                "Reserve withdrawal pending",
                "One-time Paystack submission",
            ],
            [
                "Risk/limit review",
                "Unknown Paystack outcome",
                "Remain reserved",
                "Reconcile same reference",
            ],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        table_block(
            ["Control", "Implemented behavior", "Failure behavior"],
            [
                ("Identity", "Verified profile plus NIN interim gate.", "Request denied."),
                ("Bank ownership", "Resolved Paystack name must match verified profile tokens.", "Recipient rejected or manual review."),
                ("Bank change", "Configurable 24-hour default delay.", "Withdrawal denied until age threshold."),
                ("Velocity", "Minimum, maximum, daily and monthly NGN limits.", "Request denied before reservation."),
                ("Risk", "Active holds block; threshold can require finance approval.", "Funds remain available until a valid reservation."),
                ("Submission", "Persistent 16-50 character internal reference and one database claim.", "Unknown result remains reserved; never auto-resubmitted."),
                ("Finalization", "Verify amount, currency, environment and provider state.", "Success -> withdrawn; failed/reversed -> returned."),
            ],
            [30 * mm, 80 * mm, 58 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        callout(
            "DOUBLE-SPEND DEFENSE",
            "Concurrent requests lock the available account and withdrawal workflow record. The first valid reservation reduces available earnings; a competing request sees the reduced balance and cannot overdraw it.",
            "green",
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Withdrawal journals", "H2x"))
    story.append(
        table_block(
            ["Event", "Decrease", "Increase"],
            [
                ("Reserve request", "Artisan available earnings", "Artisan withdrawal pending"),
                ("Provider success", "Artisan withdrawal pending", "Artisan withdrawn earnings"),
                ("Provider failed/reversed", "Artisan withdrawal pending", "Artisan available earnings"),
            ],
            [45 * mm, 61 * mm, 62 * mm],
        )
    )
    story.append(PageBreak())

    story.extend(
        section_header(
            6,
            "Webhook, idempotency and reliability",
            "The public webhook does not synchronously perform financial side effects in v3. It verifies, persists and acknowledges; a worker performs idempotent domain processing.",
        )
    )
    story.append(
        flow_strip(
            [
                "Raw body",
                "HMAC validation",
                "Durable event",
                "HTTP 200",
                "Worker lease",
                "Provider verify",
                "Domain posting",
            ],
            accent_index=2,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        table_block(
            ["Reliability mechanism", "What it prevents", "Storage/control"],
            [
                ("Payload hash uniqueness", "The same signed event being processed twice.", "provider_events unique provider + hash"),
                ("Provider ID uniqueness", "Alternate duplicate delivery where an ID is supplied.", "provider_events unique provider + event ID"),
                ("Request hash", "Same idempotency key reused with a changed amount or target.", "financial_idempotency_records"),
                ("Posting key", "Duplicate money movement across callback and webhook.", "money_transactions unique idempotency key"),
                ("Processing lease", "Two workers processing the same event concurrently.", "FOR UPDATE SKIP LOCKED + token"),
                ("Bounded retry", "Silent transient failure or infinite retry loops.", "attempt count, backoff and dead letter"),
                ("Transactional outbox", "Notification side effects being lost before commit.", "financial_outbox_events"),
            ],
            [42 * mm, 65 * mm, 61 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Provider events explicitly handled", "H2x"))
    story.append(
        info_cards(
            [
                ("Collections", "charge.success"),
                ("Transfers", "transfer.success / failed / reversed"),
                ("Refunds", "pending / processing / needs-attention / failed / processed"),
                ("Disputes", "charge.dispute.create"),
            ],
            cols=2,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        callout(
            "FAIL-CLOSED RULE",
            "Invalid signatures are rejected. Signed but unknown event types are retained and marked ignored. Repeated failures move to dead letter and require an operational alert.",
            "red",
        )
    )
    story.append(PageBreak())

    story.extend(
        section_header(
            7,
            "Refunds, disputes and chargebacks",
            "External reversals are modeled as explicit workflows and balanced journals. No posted history is edited.",
        )
    )
    story.append(p("Refund flow", "H2x"))
    story.append(
        flow_strip(
            [
                "Locked job funds",
                "Refund pending",
                "Paystack refund",
                "Provider terminal event",
                "External clearing",
            ],
            accent_index=1,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(
        table_block(
            ["Refund state", "Internal money state", "Required action"],
            [
                ("REQUESTED / PROCESSING", "Client refund-pending remains non-spendable.", "Wait for signed Paystack state."),
                ("NEEDS_ATTENTION", "Reservation remains intact.", "Finance verifies customer details and follows Paystack retry procedure."),
                ("PROCESSED", "Refund pending decreases; external payment clearing increases.", "Notify client and reconcile."),
                ("FAILED", "Refund pending moves to client refundable funds.", "Finance decides safe retry or future-booking use."),
            ],
            [39 * mm, 75 * mm, 54 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Dispute and chargeback flow", "H2x"))
    story.append(
        flow_strip(
            [
                "Signed dispute",
                "Mark job disputed",
                "Move accessible earnings to risk hold",
                "Outcome decision",
                "Chargeback journal or release",
            ],
            accent_index=2,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(
        callout(
            "LOSS ALLOCATION",
            "A lost dispute consumes locked job funds if unreleased. After release, it consumes the artisan risk hold and related commission first; any remaining shortfall is recorded against the platform operational reserve. Compliance and finance must approve this policy.",
            "amber",
        )
    )
    story.append(PageBreak())

    story.extend(
        section_header(
            8,
            "Data model, controls and reporting",
            "Workflow tables explain business state; the immutable journal explains every monetary movement.",
        )
    )
    story.append(
        table_block(
            ["Domain area", "Primary records", "Key protections"],
            [
                ("Ledger", "money_accounts, money_transactions, money_entries", "Balanced journal, nonnegative policy, immutable posting"),
                ("Collection", "marketplace_payment_intents, provider_events", "Unique references, exact verification, durable ingestion"),
                ("Booking funds", "job_funds, platform_fee_rules, earnings_holds", "One row per booking, versioned fee, timed release"),
                ("Withdrawals", "transfer_recipients, marketplace_withdrawal_requests", "Masked account, ownership, reservation, single submission"),
                ("Refund/risk", "refund_requests, financial_disputes, risk_holds, financial_chargebacks", "Explicit state and compensating entries"),
                ("Operations", "financial_audit_logs, financial_outbox_events, reconciliation_items", "Attribution, reliable side effects, exception evidence"),
                ("Access", "financial_admin_permissions, financial_adjustments", "Least privilege, reason, ticket and balanced adjustment"),
            ],
            [31 * mm, 69 * mm, 68 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Reports derived from immutable records", "H2x"))
    story.append(
        info_cards(
            [
                ("User statements", "Complete transaction history with reference and related booking."),
                ("Artisan earnings", "Gross release, fee, pending-to-available events and withdrawals."),
                ("Client payments", "Intent, provider reference, booking, amount and status."),
                ("Platform finance", "Commission, refunds, failures, daily summary and reconciliation variance."),
            ],
            cols=2,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Reconciliation layers", "H2x"))
    story.append(
        flow_strip(
            [
                "Ledger entries",
                "Account projections",
                "Workflow states",
                "Paystack records",
                "Settlement / bank",
                "Finance sign-off",
            ],
            accent_index=3,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(
        callout(
            "NO DIRECT BALANCE EDITS",
            "Finance corrections require a typed reversal or a permission-gated adjustment with an idempotency key, reason and ticket. Support remains view-only.",
            "red",
        )
    )
    story.append(PageBreak())

    story.extend(
        section_header(
            9,
            "Production posture and activation gates",
            "The architecture is implemented, type-checked and production-built, but the v3 schema and feature flag remain intentionally inactive.",
        )
    )
    story.append(
        table_block(
            ["Gate", "Current status", "Required completion"],
            [
                ("Application architecture", "IMPLEMENTED", "Review and commit the working tree."),
                ("Type and build validation", "PASSED", "Repeat in deployment CI."),
                ("Financial unit/property tests", "9 PASSED / 1 SKIPPED", "Run MySQL concurrency test against an isolated test database."),
                ("V3 migration", "DRY RUN PASSED", "Apply first to staging; repeat and reconcile."),
                ("Paystack E2E", "NOT RUN", "Exercise payment, duplicate event, transfer, refund and dispute in test mode."),
                ("Worker operations", "NOT CONFIGURED", "Provision secret, scheduler, uptime and dead-letter alerts."),
                ("Finance permissions", "SCHEMA READY", "Grant only to named MFA-protected finance users."),
                ("Compliance", "OPEN", "Approve characterization, KYC/AML, terms, tax and dispute policy."),
            ],
            [43 * mm, 40 * mm, 85 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Controlled activation sequence", "H2x"))
    story.append(
        flow_strip(
            [
                "Encrypted backup",
                "Staging migration",
                "Reconcile",
                "Paystack test E2E",
                "Controlled canary",
                "Global flag",
            ],
            accent_index=1,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        callout(
            "CURRENT DECISION",
            "Keep MARKETPLACE_FINANCE_V3_ENABLED=false. Do not apply the v3 production migration or enable live flows until staging, Paystack configuration, finance operations and compliance gates are signed off.",
            "red",
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Required Paystack operations", "H2x"))
    for item in [
        "Configure the production HTTPS webhook URL and verify signed test delivery.",
        "Confirm registered-business transfer eligibility, approval mode and sufficient transfer/refund balance.",
        "Separate test and live keys in the deployment secret manager; restrict dashboard access and require MFA.",
        "Reconcile internal references against Paystack payments, refunds, transfers and settlement records.",
    ]:
        story.append(bullet(item))
    story.append(PageBreak())

    story.extend(
        section_header(
            10,
            "Architecture decisions and references",
            "The design prioritizes financial correctness, traceability and safe failure over preserving unsafe legacy wallet behavior.",
        )
    )
    story.append(
        info_cards(
            [
                ("IMPLEMENTED", "Booking-specific ledger, release states, withdrawals, refunds, risk, events, outbox and reporting."),
                ("TESTED", "Type-check, property/invariant tests, migration dry run and optimized Next.js build."),
                ("MIGRATION READY", "Additive and checksummed; staging rehearsal is still mandatory."),
                ("BUSINESS DECISION", "Fee, hold, limits, refundable-fund reuse and controlled-canary policy."),
                ("PAYSTACK CONFIGURATION", "Webhook, transfer approval, balance, settlement, roles and MFA."),
                ("COMPLIANCE CONFIRMATION", "Custody characterization, KYC/AML, tax, customer terms and incident duties."),
            ],
            cols=2,
        )
    )
    story.append(Spacer(1, 6 * mm))
    story.append(p("Repository source documents", "H2x"))
    sources = [
        ("Architecture", "docs/wallet-architecture.md"),
        ("Business rules", "docs/wallet-business-rules.md"),
        ("State machines", "docs/wallet-state-machines.md"),
        ("Paystack boundary", "docs/paystack-integration.md"),
        ("Migration runbook", "docs/wallet-migration-runbook.md"),
        ("Reconciliation runbook", "docs/wallet-reconciliation-runbook.md"),
        ("Incident response", "docs/financial-incident-response.md"),
        ("Final implementation report", "docs/wallet-overhaul-final-report.md"),
    ]
    story.append(table_block(["Document", "Repository path"], sources, [55 * mm, 113 * mm]))
    story.append(Spacer(1, 6 * mm))
    story.append(p("External technical references", "H2x"))
    for item in [
        "Paystack Webhooks - https://paystack.com/docs/payments/webhooks/",
        "Paystack Verify Payments - https://paystack.com/docs/payments/verify-payments/",
        "Paystack Single Transfers - https://paystack.com/docs/transfers/single-transfers/",
        "Paystack Refunds - https://paystack.com/docs/payments/refunds/",
    ]:
        story.append(bullet(item))
    story.append(Spacer(1, 7 * mm))
    story.append(
        callout(
            "DOCUMENT CONTROL",
            "This PDF describes the implementation present in the local Anywork365 workspace on 28 July 2026. It is an architecture and operating-control document, not legal advice or evidence of production activation.",
            "teal",
        )
    )
    return story


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = ArchitectureDoc(str(OUTPUT))
    document.build(build_story())
    print(OUTPUT)


if __name__ == "__main__":
    main()
