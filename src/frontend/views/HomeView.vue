<script setup lang="ts">
const { platform } = window.bulletin
</script>

<template>
  <main>
    <h1>Bulletin</h1>
    <p>
      Platform:
      <strong data-test="platform">{{ platform }}</strong>
    </p>
  </main>
</template>
