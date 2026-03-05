import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

interface PortGenerationArgs {
  ioDeviceId: Id<"ioDevices">;
  shortName: string;
  inputCount: number;
  outputCount: number;
  headphoneOutputCount: number;
  aesInputCount: number;
  aesOutputCount: number;
}

export async function generatePorts(
  ctx: MutationCtx,
  args: PortGenerationArgs
) {
  const { ioDeviceId, shortName, inputCount, outputCount, headphoneOutputCount, aesInputCount, aesOutputCount } = args;

  // Create input ports
  for (let i = 1; i <= inputCount; i++) {
    await ctx.db.insert("ioPorts", {
      ioDeviceId,
      type: "input",
      portNumber: i,
      label: `${shortName}-I${i}`,
      subType: "regular",
    });
  }

  // Create output ports
  for (let i = 1; i <= outputCount; i++) {
    await ctx.db.insert("ioPorts", {
      ioDeviceId,
      type: "output",
      portNumber: i,
      label: `${shortName}-O${i}`,
      subType: "regular",
    });
  }

  // Create headphone output ports (stereo pairs)
  for (let i = 1; i <= headphoneOutputCount; i++) {
    await ctx.db.insert("ioPorts", {
      ioDeviceId,
      type: "output",
      portNumber: outputCount + (i - 1) * 2 + 1,
      label: `${shortName}-HP${i}L`,
      subType: "headphone_left",
      headphoneNumber: i,
    });
    await ctx.db.insert("ioPorts", {
      ioDeviceId,
      type: "output",
      portNumber: outputCount + (i - 1) * 2 + 2,
      label: `${shortName}-HP${i}R`,
      subType: "headphone_right",
      headphoneNumber: i,
    });
  }

  // Create AES input ports (stereo pairs)
  for (let i = 1; i <= aesInputCount; i++) {
    await ctx.db.insert("ioPorts", {
      ioDeviceId,
      type: "input",
      portNumber: inputCount + (i - 1) * 2 + 1,
      label: `${shortName}-AES${i}L`,
      subType: "aes_left",
      aesNumber: i,
    });
    await ctx.db.insert("ioPorts", {
      ioDeviceId,
      type: "input",
      portNumber: inputCount + (i - 1) * 2 + 2,
      label: `${shortName}-AES${i}R`,
      subType: "aes_right",
      aesNumber: i,
    });
  }

  // Create AES output ports (stereo pairs)
  const hpPortCount = headphoneOutputCount * 2;
  for (let i = 1; i <= aesOutputCount; i++) {
    await ctx.db.insert("ioPorts", {
      ioDeviceId,
      type: "output",
      portNumber: outputCount + hpPortCount + (i - 1) * 2 + 1,
      label: `${shortName}-AESO${i}L`,
      subType: "aes_left",
      aesNumber: i,
    });
    await ctx.db.insert("ioPorts", {
      ioDeviceId,
      type: "output",
      portNumber: outputCount + hpPortCount + (i - 1) * 2 + 2,
      label: `${shortName}-AESO${i}R`,
      subType: "aes_right",
      aesNumber: i,
    });
  }
}
