// DOCX 리포트 생성 — bizplan-ai의 docx 생성 패턴을 단순화해 이식
// 학부모 리포트·영재교육원 의뢰서·학습클리닉 의뢰서 3종

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from "docx"
import type { Intelligence } from "./strength-matrix"
import { INTELLIGENCES } from "./strength-matrix"

export type DocxBuildInput = {
  title: string
  subtitle?: string
  studentName: string
  bodyMd: string  // 마크다운 — 간단히 줄 단위 파싱
  scores?: Record<Intelligence, number>
}

// 마크다운 → docx 단순 변환 (헤딩·리스트·일반 단락만 지원)
function mdToParagraphs(md: string): Paragraph[] {
  const lines = md.split("\n")
  const out: Paragraph[] = []
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      out.push(new Paragraph({ children: [new TextRun(" ")] }))
      continue
    }
    if (line.startsWith("# ")) {
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: line.slice(2), bold: true })] }))
    } else if (line.startsWith("## ")) {
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line.slice(3), bold: true })] }))
    } else if (line.startsWith("### ")) {
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: line.slice(4), bold: true })] }))
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      out.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(line.slice(2))] }))
    } else {
      out.push(new Paragraph({ children: [new TextRun(line)] }))
    }
  }
  return out
}

function buildScoreTable(scores: Record<Intelligence, number>): Table {
  const rows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "지능 영역", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "점수 (0~10)", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "설명", bold: true })] })] }),
      ],
    }),
  ]
  for (const [code, score] of Object.entries(scores) as [Intelligence, number][]) {
    const meta = INTELLIGENCES[code]
    const bar = "■".repeat(Math.round(score)) + "□".repeat(10 - Math.round(score))
    rows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(`${meta.emoji} ${meta.name}`)] }),
          new TableCell({ children: [new Paragraph(`${score} ${bar}`)] }),
          new TableCell({ children: [new Paragraph(meta.description)] }),
        ],
      })
    )
  }
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  })
}

export async function buildReportDocx(input: DocxBuildInput): Promise<Buffer> {
  const children: (Paragraph | Table)[] = []

  // 표지
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: input.title, bold: true, size: 44 })],
    })
  )
  if (input.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: input.subtitle, italics: true, size: 28 })],
      })
    )
  }
  children.push(new Paragraph({ children: [new TextRun(" ")] }))
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `학생: ${input.studentName}`, bold: true, size: 26 })],
    })
  )
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `생성일: ${new Date().toLocaleDateString("ko-KR")}`, size: 22 })],
    })
  )
  children.push(new Paragraph({ children: [new TextRun(" ")] }))

  // 점수 테이블
  if (input.scores) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "강점 프로파일", bold: true })],
      })
    )
    children.push(buildScoreTable(input.scores))
    children.push(new Paragraph({ children: [new TextRun(" ")] }))
  }

  // 본문
  for (const p of mdToParagraphs(input.bodyMd)) children.push(p)

  // 푸터
  children.push(new Paragraph({ children: [new TextRun(" ")] }))
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "별의아이들 (Gleam) — 제8회 교육공공데이터 AI활용대회 출품작",
          italics: true,
          size: 18,
          color: "888888",
        }),
      ],
    })
  )

  const doc = new Document({
    creator: "별의아이들",
    title: input.title,
    sections: [{ children }],
  })
  return Packer.toBuffer(doc)
}
