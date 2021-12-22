<template>
  <p>Hello</p>
</template>

<script>
export default {
  async created(){
    
  },
  methods: {
    async getAuditsAndComments() {
      this.loadingLogs = true
      const data = await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: this.dbAlias }, 'xcModelRowAuditAndCommentList', {
        model_id: this.meta.columns.filter(c => c.pk).map(c => this.localState[c._cn]).join('___'),
        model_name: this.meta._tn,
        comments: this.commentsOnly
      }])
      this.logs = data.list
      console.log("logs")
      console.log(this.logs)
      this.loadingLogs = false
    },
  }
}
</script>