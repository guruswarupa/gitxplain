from fastapi import APIRouter, HTTPException
from typing import List
from backend.app.models import CodeReviewRequest, CodeReviewResult, CodeIssue
from backend.app.services.cli_service import CLIService

router = APIRouter()

def analyze_code_content(code: str, file_path: str) -> CodeReviewResult:
    """Analyze code content and return issues"""
    
    # Check if it's Python code
    if file_path.endswith(".py"):
        analysis = CLIService.analyze_code_with_pylint(code, file_path)
        
        issues = []
        summary = ""
        
        if analysis.get("available"):
            pylint_issues = analysis.get("issues", [])
            
            # Convert pylint format to our format
            for issue in pylint_issues:
                severity = "info"
                if issue.get("type") in ["error", "fatal"]:
                    severity = "error"
                elif issue.get("type") == "warning":
                    severity = "warning"
                
                issues.append(CodeIssue(
                    line=issue.get("line", 0),
                    severity=severity,
                    message=issue.get("message", ""),
                    suggestion=None,
                ))
            
            if issues:
                summary = f"Found {len(issues)} issues in the code"
            else:
                summary = "Code looks good! No issues found"
        else:
            # pylint not available, do basic checks
            issues = _basic_code_analysis(code, file_path)
            summary = f"Basic analysis: Found {len(issues)} potential issues"
    else:
        # Non-Python files - do basic analysis
        issues = _basic_code_analysis(code, file_path)
        summary = f"Basic analysis: Found {len(issues)} potential issues"
    
    return CodeReviewResult(
        file=file_path,
        issues=issues,
        summary=summary,
    )

def _basic_code_analysis(code: str, file_path: str) -> List[CodeIssue]:
    """Perform basic code analysis without external tools"""
    issues = []
    lines = code.split("\n")
    
    for line_num, line in enumerate(lines, 1):
        # Check for common issues
        stripped = line.strip()
        
        # Check for long lines
        if len(line) > 120:
            issues.append(CodeIssue(
                line=line_num,
                severity="warning",
                message="Line is too long (over 120 characters)",
                suggestion="Consider breaking this line into smaller parts",
            ))
        
        # Check for trailing whitespace
        if line != line.rstrip():
            issues.append(CodeIssue(
                line=line_num,
                severity="info",
                message="Trailing whitespace detected",
                suggestion="Remove trailing whitespace",
            ))
        
        # Check for TODO/FIXME comments
        if "TODO" in line or "FIXME" in line:
            issues.append(CodeIssue(
                line=line_num,
                severity="info",
                message="TODO/FIXME comment found",
                suggestion="Address this task or remove the comment",
            ))
        
        # Check for unused variables (simple heuristic for Python)
        if file_path.endswith(".py"):
            if stripped.startswith("_") and "=" in stripped:
                issues.append(CodeIssue(
                    line=line_num,
                    severity="info",
                    message="Variable starts with underscore (may be unused)",
                    suggestion="Consider removing unused variables",
                ))
    
    return issues

@router.post("/code-review", response_model=List[CodeReviewResult])
async def submit_code_review(request: CodeReviewRequest):
    """
    Submit code for review and analysis
    
    Analyzes code for:
    - Style issues
    - Potential bugs
    - Performance concerns
    - Best practice violations
    """
    try:
        if not request.code.strip():
            raise HTTPException(status_code=400, detail="Code content is empty")
        
        result = analyze_code_content(request.code, request.file_path)
        return [result]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
