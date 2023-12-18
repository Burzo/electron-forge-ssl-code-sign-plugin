# @burzo/electron-forge-ssl-code-sign-plugin

Due to changes mentioned in the [electron-forge documentation](https://www.electronforge.io/guides/code-signing/code-signing-windows), the previous method of using certificates provided by [SSL.com](https://www.ssl.com/) is no longer viable. This is where our plugin comes into play.

This plugin ensures that once the `@electron-forge/maker-squirrel` completes its make process, it signs the generated `exe` and `nupkg` files using the [eSigner CodeSignTool](https://www.ssl.com/guide/esigner-codesigntool-command-guide/) provided by SSL.com.

Please note that `msi` files are currently not supported for signing.

## Prerequisites

This plugin works with electron-forge version >=7.

Additionally, you need to download the CodeSignTool:

- [Download for Windows](https://www.ssl.com/download/codesigntool-for-windows/)

Please keep in mind that this plugin currently supports building only on Windows-based machines.

## Installation

```
npm i --save-dev @burzo/electron-forge-ssl-code-sign-plugin
```

or

```
yarn add --dev @burzo/electron-forge-ssl-code-sign-plugin
```

## Configuration

The plugin accepts the following configuration variables:

- `userName`: Typically, this is the email set on [express.esigner.com](https://express.esigner.com/esign) or [app.esigner.com](https://app.esigner.com/).
- `password`: The password associated with the above `userName`.
- `credentialId`: The eSigner credential ID found under the certificate's signing credentials on [secure.ssl.com](https://secure.ssl.com/login).
- `signToolPath`: The **absolute** path to the CodeSignTool you downloaded from SSL.com.
- `userTotp` (optional): The secret key generated when creating the QR code on [secure.ssl.com](https://secure.ssl.com/login). For more information, see [here](https://www.ssl.com/how-to/automate-esigner-ev-code-signing/).

If you don't pass in `userTotp`, then `electron-forge` will pause the process when signing the app and wait for you to input the code via the OTP you set up on [secure.ssl.com](https://secure.ssl.com/login).

Include the plugin in your Forge config as follows:

```
    ...,
    "plugins": [
		{
			name: "@burzo/electron-forge-ssl-code-sign-plugin",
			config: {
				userName: "some@email.com",
				password: "mypass",
				credentialId: "credential-id",
				userTotp: "secret-key",
				signToolPath: "C:/apps/my-electron-forge-app/CodeSignTool-v1.3.0-windows/CodeSignTool",
			},
		},
    ],
    ...,
```

## Contribution

If anyone would like to add `msi` signing support, feel free to submit a PR :)
