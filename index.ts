import PluginBase from "@electron-forge/plugin-base";
import {
  ForgeConfigMaker,
  ForgeMakeResult,
  ForgeMultiHookMap,
  ResolvedForgeConfig,
} from "@electron-forge/shared-types";
import { ExecSyncOptionsWithStringEncoding, execSync } from "child_process";
import fs from "fs-extra";
import path from "path";

type ConfigTypes = {
  userName: string;
  password: string;
  credentialId: string;
  userTotp?: string;
  signToolPath: string;
};

export class ElectronForgeSslCodeSignPlugin extends PluginBase<ConfigTypes> {
  name = "@burzo/electron-forge-ssl-code-sign-plugin";
  config: ConfigTypes;

  constructor(config: ConfigTypes) {
    super(config);
    this.config = config;
  }

  getHooks(): ForgeMultiHookMap {
    return { postMake: [this.postMake] };
  }

  postMake = async (
    forgeConfig: ResolvedForgeConfig,
    makeResults: ForgeMakeResult[],
  ) => {
    const squirrelMaker: ForgeConfigMaker | undefined = forgeConfig.makers.find(
      (maker) => "name" in maker && maker.name === "squirrel",
    );
    const squirrelResolvableMaker: ForgeConfigMaker | undefined =
      forgeConfig.makers.find(
        (maker) =>
          "name" in maker && maker.name === "@electron-forge/maker-squirrel",
      );
    if (!squirrelMaker && !squirrelResolvableMaker) {
      throw new Error(
        `The plugin ${this.name} can not work without "@electron-forge/maker-squirrel" or "squirrel". Remove it from the plugins array.`,
      );
    }

    const { userName, password, credentialId, userTotp, signToolPath } =
      this.config;

    return makeResults.map((data) => {
      const { artifacts, platform } = data;

      if (platform !== "win32") {
        return data;
      }

      if (!userName || !password || !credentialId || !signToolPath) {
        throw new Error(
          `You did not provide all the required config variables to ${
            this.name
          }.\nCurrent values:\n${Object.keys(this.config)
            .map((key) => `${key}  -  ${this.config[key as keyof ConfigTypes]}`)
            .join("\n")}`,
        );
      }

      const releasesPath = artifacts[0];

      /**
       * The exe is located where RELEASES is.
       */
      if (releasesPath.endsWith("RELEASES")) {
        /**
         * We first parse the RELEASES file to get out the .nupkg file name
         * saved there. If setupExe wasn't changed in the squirrel maker
         * config, then we can use this parsed name to get the .exe file
         * name as well.
         *
         * If setupExe was set, then we need to use that instead to get
         * the correct .exe path for signing.
         */
        const nupkgFileName = fs
          .readFileSync(releasesPath, "utf8")
          .split(" ")[1];

        const nupkgFilePath = releasesPath.replace("RELEASES", nupkgFileName);

        const exeArtifact = artifacts.find((artifact) =>
          artifact.endsWith(".exe"),
        );

        const exeName =
          exeArtifact || nupkgFileName.replace("-full.nupkg", ".exe");

        const exeFilePath = releasesPath.replace("RELEASES", exeName);

        /**
         * The CodeSignTool calls other subfolders which means it needs
         * the absolute path in case you're calling it from anywhere
         * else other then it's root folder. This is their code:
         *
         * set code_sign_tool_path=%CODE_SIGN_TOOL_PATH%
         *
         * if defined code_sign_tool_path (
         * 		%code_sign_tool_path%\jdk-11.0.2\bin\java -jar %code_sign_tool_path%\jar\code_sign_tool-1.3.0.jar %*
         * ) else (
         * 		.\jdk-11.0.2\bin\java -jar .\jar\code_sign_tool-1.3.0.jar %*
         * )
         */
        const { dir: codeSignToolFolder, name } = path.parse(signToolPath);
        const codeSignToolFile = path.join(codeSignToolFolder, name);

        const execSyncSettings = {
          stdio: "inherit",
          encoding: "utf8",
          env: {
            ...process.env,
            CODE_SIGN_TOOL_PATH: codeSignToolFolder,
          },
        } as ExecSyncOptionsWithStringEncoding;

        /**
         * We sign both the .exe and .nupkg files.
         */
        try {
          execSync(
            `${codeSignToolFile} sign -input_file_path="${exeFilePath}" -override="true" -credential_id="${credentialId}" -username="${userName}" -password="${password}" ${
              userTotp ? `-totp_secret="${userTotp}"` : ""
            }`,
            execSyncSettings,
          );

          /**
           * To sign the .nupkg files we also need to make sure the CodeSignTool
           * has the following config property set - TSA_LEGACY_URL=http://ts.ssl.com/legacy
           * as per https://www.ssl.com/how-to/code-signing-nuget-packages-with-esigner-codesigntool/.
           */
          const pathtoCodeSignToolConf = path.join(
            codeSignToolFolder,
            "conf",
            "code_sign_tool.properties",
          );
          const codeSignToolConfig = fs.readFileSync(
            pathtoCodeSignToolConf,
            "utf8",
          );

          if (
            !codeSignToolConfig.includes(
              "TSA_LEGACY_URL=http://ts.ssl.com/legacy",
            )
          ) {
            fs.appendFileSync(
              pathtoCodeSignToolConf,
              `\nTSA_LEGACY_URL=http://ts.ssl.com/legacy`,
            );
          }

          execSync(
            `${codeSignToolFile} sign -input_file_path="${nupkgFilePath}" -override="true" -credential_id="${credentialId}" -username="${userName}" -password="${password}" ${
              userTotp ? `-totp_secret="${userTotp}"` : ""
            }`,
            execSyncSettings,
          );
        } catch (e) {
          if (e instanceof Error) {
            throw new Error(e.message);
          } else {
            throw e;
          }
        }
      }

      return data;
    });
  };
}
