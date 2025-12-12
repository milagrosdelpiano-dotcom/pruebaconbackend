/// <reference types="https://deno.land/x/deno@v1.28.0/lib/deno.d.ts" />

// Declaración global para Deno
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};


