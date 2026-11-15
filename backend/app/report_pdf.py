"""Printable PDF for the fields shown in the Incident Report page."""
from __future__ import annotations

from html import escape
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


NOTICE = "SYNTHETIC DEMONSTRATION DATA - NOT A REAL MEDICAL RECORD"


def display(value, unit=""):
    if value is None or value == "":
        return "Not recorded"
    return f"{value}{unit}"


def stamp(value):
    if not value:
        return "Not recorded"
    return str(value).replace("T", " ")[:16] + " UTC"


def render_report_pdf(snapshot: dict) -> bytes:
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm,
                            topMargin=23*mm, bottomMargin=21*mm,
                            title=f"MEDNAV {snapshot['astronaut_id']} health report")
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="MedTitle", parent=styles["Title"], fontName="Helvetica-Bold",
                              fontSize=19, leading=23, textColor=colors.HexColor("#142238"), spaceAfter=8))
    styles.add(ParagraphStyle(name="MedSection", parent=styles["Heading2"], fontSize=12, leading=15,
                              textColor=colors.HexColor("#165677"), spaceBefore=14, spaceAfter=7))
    styles.add(ParagraphStyle(name="MedBody", parent=styles["BodyText"], fontSize=9, leading=13, spaceAfter=7))
    styles.add(ParagraphStyle(name="MedCell", parent=styles["BodyText"], fontSize=8, leading=11))

    def paragraph(value, style="MedBody"):
        return Paragraph(escape(str(value)), styles[style])

    def table(rows, widths):
        item = Table([[paragraph(cell, "MedCell") for cell in row] for row in rows],
                     colWidths=widths, repeatRows=1, hAlign="LEFT")
        item.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e7eef4")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LINEBELOW", (0, -1), (-1, -1), .4, colors.HexColor("#ccd6df")),
        ]))
        return item

    readings = snapshot["measurements"]
    symptoms = {}
    for symptom in snapshot["symptoms"]:
        entry = symptoms.setdefault(symptom["name"], {"latest": symptom, "count": 0})
        entry["latest"] = symptom
        entry["count"] += 1
    taken = [med for med in snapshot["medications"] if med["status"] == "taken"]
    story = [paragraph("MEDNAV HEALTH REPORT", "MedTitle"),
             paragraph(f"{snapshot['astronaut_id']}  |  {stamp(snapshot['period_start'])} to {stamp(snapshot['period_end'])}"),
             paragraph(NOTICE), Spacer(1, 3*mm),
             paragraph("Health measurements", "MedSection")]

    story.append(table([
        ["Recorded (UTC)", "Heart rate", "Sleep duration", "Blood pressure"],
        *([[stamp(row["recorded_at"]), display(row["hr"], " bpm"),
           display(row["sleep"], " h"), display(row["bp"], " mmHg")]
          for row in readings] or [["No check-ins in this period", "-", "-", "-"]]),
    ], [46*mm, 38*mm, 38*mm, 50*mm]))

    story.append(paragraph("Reported symptoms", "MedSection"))
    story.append(table([
        ["Recorded (UTC)", "Symptom", "Source"],
        *([[stamp(entry["latest"]["recorded_at"]),
           f"{name} ({entry['count']} reports)" if entry["count"] > 1 else name,
           entry["latest"]["source"]]
          for name, entry in symptoms.items()] or [["No symptoms reported", "-", "-"]]),
    ], [45*mm, 62*mm, 65*mm]))

    story.append(paragraph("Medicines taken", "MedSection"))
    story.append(table([
        ["Time (UTC)", "Taken by", "Medicine", "Amount", "Source"],
        *([[stamp(med["taken_at"]) if med["taken_at"] else f"Recorded {stamp(med['recorded_at'])}; take time unknown",
           med["astronaut_id"], med["medication_name"], display(med["dose"]), med["source"]]
          for med in taken] or [["No medicines taken are documented", "-", "-", "-", "-"]]),
    ], [38*mm, 27*mm, 43*mm, 30*mm, 34*mm]))
    story.append(Spacer(1, 5*mm))
    story.append(paragraph("Only saved observations and confirmed medicine administrations appear in this report. Missing values are not estimated."))

    def decorate(canvas, document):
        canvas.saveState()
        width, height = A4
        canvas.setStrokeColor(colors.HexColor("#2b6788"))
        canvas.line(18*mm, height-17*mm, width-18*mm, height-17*mm)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(colors.HexColor("#165677"))
        canvas.drawString(18*mm, height-14*mm, "MEDNAV / HEALTH REPORT")
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#506477"))
        canvas.drawString(18*mm, 11*mm, NOTICE)
        canvas.drawRightString(width-18*mm, 11*mm, f"Page {document.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return output.getvalue()
