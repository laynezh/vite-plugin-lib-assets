<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
const handlePlus = () => count.value += 1
const handleMinus = () => count.value -= 1
</script>

<template>
  <div class="container">
    <button @click="handleMinus">
      -
    </button>
    <span>{{ count }}</span>
    <button @click="handlePlus">
      +
    </button>
  </div>
</template>

<style scoped>
.container {
  background-image: url(./assets/vite-logo-vue-css.svg);
}
</style>
