<template>
  <div>
    <v-menu
      open-on-hover
      bottom
      offset-y
    >
      <template #activator="{on}">
        <v-btn
          outlined
          class="nc-actions-menu-btn caption px-2"
          small
          text
          v-on="on"
        >
          <v-icon small color="#777">
            mdi-flash-outline
          </v-icon>
          Actions

          <v-icon small color="#777">
            mdi-menu-down
          </v-icon>
        </v-btn>
      </template>

      <v-list dense>
        <v-list-item
          dense
          @click="exportCsv"
        >
          <v-list-item-title>
            <v-icon small class="mr-1">
              mdi-download-outline
            </v-icon>
            <span class="caption">
              Download as CSV
            </span>
          </v-list-item-title>
        </v-list-item>
        <v-list-item
          v-if="_isUIAllowed('csvImport') && !isView"
          dense
          @click="importModal = true"
        >
          <v-list-item-title>
            <v-icon small class="mr-1" color="">
              mdi-upload-outline
            </v-icon>
            <span class="caption ">
              Upload CSV
            </span>

            <span class="caption grey--text">(<x-icon small color="grey lighten-2">
              mdi-alpha
            </x-icon> version)</span>
          </v-list-item-title>
        </v-list-item>
        
         <v-list-item
          dense
          @click="downloadPdf"
        >
          <v-list-item-title>
            <v-icon small class="mr-1">
              mdi-download-outline
            </v-icon>
            <span class="caption">
              Download as PDF
            </span>
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <drop-or-select-file-modal v-model="importModal" accept=".csv" text="CSV" @file="onCsvFileSelection" />
    <column-mapping-modal
      v-if="columnMappingModal && meta"
      v-model="columnMappingModal"
      :meta="meta"
      :import-data-columns="parsedCsv.columns"
      :parsed-csv="parsedCsv"
      @import="importData"
    />
  </div>
</template>

<script>

import FileSaver from 'file-saver'
import DropOrSelectFileModal from '~/components/import/dropOrSelectFileModal'
import ColumnMappingModal from '~/components/project/spreadsheet/components/columnMappingModal'
import CSVTemplateAdapter from '~/components/import/templateParsers/CSVTemplateAdapter'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default {
  name: 'ExportImport',
  components: { ColumnMappingModal, DropOrSelectFileModal },
  props: {
    meta: Object,
    nodes: Object,
    selectedView: Object,
    publicViewId: String,
    queryParams: Object,
    isView: Boolean
  },
  data() {
    return {
      importModal: false,
      columnMappingModal: false,
      parsedCsv: {}
    }
  },

  methods: {
    async onCsvFileSelection(file) {
      const reader = new FileReader()
      reader.onload = async(e) => {
        const templateGenerator = new CSVTemplateAdapter(file.name, e.target.result)
        await templateGenerator.init()
        templateGenerator.parseData()
        this.parsedCsv.columns = templateGenerator.getColumns()
        this.parsedCsv.data = templateGenerator.getData()
        this.columnMappingModal = true
        this.importModal = false
      }

      reader.readAsText(file)
    },

   
    async downloadPdf(){

      const doc = new jsPDF()
      let offset = 0
      let c = 1
      const res = await this.$store.dispatch('sqlMgr/ActSqlOp', [
            this.publicViewId
              ? null
              : {
                  dbAlias: this.nodes.dbAlias,
                  env: '_noco'
                },
            this.publicViewId ? 'sharedViewExportAsCsv' : 'xcExportAsCsv',
            {
              query: { offset },
              localQuery: this.queryParams || {},
              ...(this.publicViewId
                ? {
                    view_id: this.publicViewId
                  }
                : {
                    view_name: this.selectedView.title,
                    model_name: this.meta.tn
                  })
            },
            null,
            {
              responseType: 'blob'
            },
            null,
            true
          ])
      console.log(res)
      const data = res.data
      console.log(data)    
      const blob = new Blob([data], { type: 'application/pdf;charset-UTF-8'})
      console.log(blob)
      
      const resData = JSON.parse(JSON.stringify(data))
      console.log("Response Parse")
      console.log(resData)
      doc.text(blob)
      doc.save("table.pdf")


    },
 
    async importData(columnMappings) {
      try {
        const api = this.$ncApis.get({
          table: this.meta.tn
        })

        const data = this.parsedCsv.data
        for (let i = 0, progress = 0; i < data.length; i += 500) {
          const batchData = data.slice(i, i + 500).map(row => columnMappings.reduce((res, col) => {
            // todo: parse data

            if (col.enabled && col.destCn && col.destCn._cn) {
              res[col.destCn._cn] = row[col.sourceCn]
            }
            return res
          }, {}))
          await api.insertBulk(batchData)
          progress += batchData.length
          this.$store.commit('loader/MutMessage', `Importing data : ${progress}/${data.length}`)
          this.$store.commit('loader/MutProgress', Math.round((100 * progress / data.length)))
        }
        this.columnMappingModal = false
        this.$store.commit('loader/MutClear')
        this.$toast.success('Successfully imported table data').goAway(3000)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }

}
</script>

<style scoped>

</style>
