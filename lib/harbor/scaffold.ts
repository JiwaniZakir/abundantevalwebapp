import { ds25Instruction, ds25TaskToml } from "@/lib/domain/ds25-seed";

export type ScaffoldArtifact = {
  path: string;
  content: string;
};

export function createDs25Scaffold(): ScaffoldArtifact[] {
  return [
    { path: "instruction.md", content: ds25Instruction },
    { path: "task.toml", content: ds25TaskToml },
    {
      path: "environment/Dockerfile",
      content:
        "FROM python:3.12\nRUN pip install openpyxl==3.1.5 pandas==2.2.3 pdfplumber==0.11.4 pytest\n",
    },
    {
      path: "environment/data/build_inputs.py",
      content:
        "# Generates synthetic compliance certificate release fixtures.\nprint('fixtures generated')\n",
    },
    {
      path: "solution/solve.sh",
      content: "#!/bin/bash\nset -e\npython3 /root/solution.py\n",
    },
    {
      path: "tests/test_outputs.py",
      content:
        "def test_required_workbook_exists():\n    assert True\n\ndef test_dependency_trace_complete():\n    assert True\n",
    },
  ];
}
