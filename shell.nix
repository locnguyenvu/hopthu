let
  pkgs = import <nixpkgs>{};
in
pkgs.mkShell rec {
  name = "docthu";
  venvDir = "./.venv";
  buildInputs = with pkgs; [
    python3Packages.python
    python3Packages.python-lsp-server
    python3Packages.ruff
    python3Packages.rich
    python3Packages.venvShellHook
  ];
  packages = with pkgs; [
    uv
    process-compose
    nodejs_24
  ];
}
