{
  description = "Bulletin development environment";

  inputs = {
    # 26.05 is the last release supporting x86_64-darwin.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
    let
      # Electron major shared by nixpkgs (Linux binary)
      # and package.json (types, macOS binary). Bump both
      # together.
      electronMajor = "44";

      pkgJson = builtins.fromJSON
        (builtins.readFile ./package.json);
      npmElectron = pkgJson.devDependencies.electron;
      npmMajor = builtins.head
        (builtins.match "[^0-9]*([0-9]+).*" npmElectron);

      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "x86_64-linux"
        "aarch64-linux"
      ];
    in
    flake-utils.lib.eachSystem systems (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        inherit (pkgs) lib stdenv;
        electron = pkgs."electron_${electronMajor}";

        # The npm prebuilt Electron does not run on NixOS,
        # so Linux uses the nixpkgs binary instead.
        # electron-vite reads ELECTRON_EXEC_PATH; the
        # electron package itself reads the override.
        linuxEnv = lib.optionalAttrs stdenv.hostPlatform.isLinux {
          ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
          ELECTRON_OVERRIDE_DIST_PATH = "${electron}/bin";
          ELECTRON_EXEC_PATH = "${electron}/bin/electron";
        };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [ pkgs.nodejs_24 pkgs.pnpm ];
          env = linuxEnv;
          shellHook = ''
            if [ "${npmMajor}" != "${electronMajor}" ]; then
              cat >&2 <<MSG
            error: Electron version mismatch.
              package.json electron: ${npmElectron}
                (major ${npmMajor})
              flake.nix electronMajor: ${electronMajor}
            Bump both to the same major version.
            MSG
              exit 1
            fi
          '';
        };
      });
}
