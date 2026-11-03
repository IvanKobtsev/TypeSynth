import type { GeneratorScriptProps } from "typesynth";

export default async function main({ data, generate }: GeneratorScriptProps) {
  for (const item of data.items) {
    await generate("contract", item, `${item.name}/contract.ts`);
    await generate("client", item, `${item.name}/client.ts`);
  }
}
