import XLSX from 'xlsx'
import { UITypes } from '~/components/project/spreadsheet/helpers/uiTypes'
import TemplateGenerator from '~/components/import/templateParsers/TemplateGenerator'
import { getCheckboxValue, isCheckboxType } from '~/components/import/templateParsers/parserHelpers'

const excelTypeToUidt = {
  d: UITypes.DateTime,
  b: UITypes.Checkbox,
  n: UITypes.Number,
  s: UITypes.SingleLineText
}

export default class ExcelTemplateAdapter extends TemplateGenerator {
  constructor(name, ab, parserConfig = {}) {
    super()
    this.config = {
      maxRowsToParse: 500,
      ...parserConfig
    }
    this.name = name
    this.excelData = ab
    this.project = {
      title: this.name,
      tables: []
    }
    this.data = {}
  }

  async init() {
    this.wb = XLSX.read(new Uint8Array(this.excelData), { type: 'array', cellText: true, cellDates: true })
  }

  parse() {
    const tableNamePrefixRef = {}
    for (let i = 0; i < this.wb.SheetNames.length; i++) {
      const columnNamePrefixRef = {}
      const sheet = this.wb.SheetNames[i]
      let tn = sheet
      if (tn in tableNamePrefixRef) {
        tn = `${tn}${++tableNamePrefixRef[tn]}`
      } else {
        tableNamePrefixRef[tn] = 0
      }

      const table = { tn, columns: [] }
      this.data[sheet] = []
      const ws = this.wb.Sheets[sheet]
      const range = XLSX.utils.decode_range(ws['!ref'])
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, cellDates: true, defval: null })

      // const colLen = Math.max()

      for (let col = 0; col < rows[0].length; col++) {
        let cn = (rows[0][col] ||
          `field${col + 1}`).replace(/\./, '_').trim()

        if (cn in columnNamePrefixRef) {
          cn = `${cn}${++columnNamePrefixRef[cn]}`
        } else {
          columnNamePrefixRef[cn] = 0
        }

        const column = {
          cn
        }
        // const cellId = `${col.toString(26).split('').map(s => (parseInt(s, 26) + 10).toString(36).toUpperCase())}2`;
        const cellId = XLSX.utils.encode_cell({
          c: range.s.c + col,
          r: 1
        })
        const cellProps = ws[cellId] || {}
        column.uidt = excelTypeToUidt[cellProps.t] || UITypes.SingleLineText

        // todo: optimize
        if (column.uidt === UITypes.SingleLineText) {
          // check for long text
          if (rows.some(r =>
            (r[col] || '').toString().match(/[\r\n]/) ||
            (r[col] || '').toString().length > 255)
          ) {
            column.uidt = UITypes.LongText
          } else {
            let vals = rows.slice(1).map(r => r[col])

            const checkboxType = isCheckboxType(vals)
            if (checkboxType.length === 1) {
              column.uidt = UITypes.Checkbox
            } else {
              vals = vals.filter(v => v !== null && v !== undefined)

              // check column is multi or single select by comparing unique values
              // todo:
              if (vals.some(v => v && v.toString().includes(','))) {
                const flattenedVals = vals.flatMap(v => v ? v.toString().split(',') : [])
                const uniqueVals = new Set(flattenedVals)
                if (flattenedVals.length > uniqueVals.size && uniqueVals.size <= Math.ceil(flattenedVals.length / 2)) {
                  column.uidt = UITypes.MultiSelect
                  column.dtxp = [...uniqueVals].join(',')
                }
              } else {
                const uniqueVals = new Set(vals)
                if (vals.length > uniqueVals.size && uniqueVals.size <= Math.ceil(vals.length / 2)) {
                  column.uidt = UITypes.SingleSelect
                  column.dtxp = [...uniqueVals].join(',')
                }
              }
            }
          }
        } else if (column.uidt === UITypes.Number) {
          if (rows.slice(1, this.config.maxRowsToParse).some((v) => {
            return v && v[col] && parseInt(+v[col]) !== +v[col]
          })) {
            column.uidt = UITypes.Decimal
          }
          if (rows.slice(1, this.config.maxRowsToParse).every((v, i) => {
            const cellId = XLSX.utils.encode_cell({
              c: range.s.c + col,
              r: i + 2
            })

            const cellObj = ws[cellId]

            return !cellObj || (cellObj.w && cellObj.w.startsWith('$'))
          })) {
            column.uidt = UITypes.Currency
          }
        } else if (column.uidt === UITypes.DateTime) {
          if (rows.slice(1, this.config.maxRowsToParse).every((v, i) => {
            const cellId = XLSX.utils.encode_cell({
              c: range.s.c + col,
              r: i + 2
            })

            const cellObj = ws[cellId]

            return !cellObj || (cellObj.w && cellObj.w.split(' ').length === 1)
          })) {
            column.uidt = UITypes.Date
          }
        }

        table.columns.push(column)
      }

      for (const row of rows.slice(1)) {
        const rowData = {}
        for (let i = 0; i < table.columns.length; i++) {
          if (table.columns[i].uidt === UITypes.Checkbox) {
            rowData[table.columns[i].cn] = getCheckboxValue(row[i])
          } else {
            // toto: do parsing if necessary based on type
            rowData[table.columns[i].cn] = row[i]
          }
        }
        this.data[sheet].push(rowData)
      }

      this.project.tables.push(table)
    }
  }

  getTemplate() {
    return this.project
  }

  getData() {
    return this.data
  }
}
