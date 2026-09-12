from ikimono_scan_ml.specified_invasive import extract_designations


def test_extract_designations_preserves_broad_scope_and_conditional_member() -> None:
    html = b"""
    <table>
      <tr><th>Family</th><th>Genus</th><th colspan="2">Specified species</th><th>Status</th></tr>
      <tr><th></th><th></th><th colspan="2">Status</th><th></th></tr>
      <tr>
        <td rowspan="2">Cambaridae</td><td rowspan="2">all genera</td>
        <td rowspan="2">all Cambaridae species</td>
        <td>Procambarus clarkii<br><a href="/conditional">conditional designation</a></td>
        <td>established</td>
      </tr>
      <tr><td>other Cambaridae</td><td>not established</td></tr>
    </table>
    """

    designations = extract_designations(
        html,
        group_names=["crustaceans"],
        specified_heading="Specified species",
        conditional_marker="conditional designation",
    )

    assert designations == [
        {
            "id": designations[0]["id"],
            "sourceId": "moe-specified-invasive-alien-species",
            "organismGroup": "crustaceans",
            "scopeText": "all Cambaridae species",
            "regulationType": "specified",
            "conditionalMembers": ["Procambarus clarkii"],
        }
    ]


def test_extract_designations_marks_wholly_conditional_scope() -> None:
    html = b"""
    <table>
      <tr><th>Family</th><th>Genus</th><th colspan="2">Specified species</th><th>Status</th></tr>
      <tr><th></th><th></th><th colspan="2">Status</th><th></th></tr>
      <tr><td>Emydidae</td><td>Trachemys</td>
      <td colspan="2">Trachemys scripta <a href="/conditional">conditional designation</a></td>
      <td>established</td></tr>
    </table>
    """

    designation = extract_designations(
        html,
        group_names=["reptiles"],
        specified_heading="Specified species",
        conditional_marker="conditional designation",
    )[0]

    assert designation["regulationType"] == "conditional"
    assert designation["conditionalMembers"] == []
