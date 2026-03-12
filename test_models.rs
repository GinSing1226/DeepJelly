// Temporary test file to verify models work correctly
// This file is standalone and will be removed after verification

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Copy the models here for standalone testing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assistant {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    pub characters: Vec<Character>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bound_agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    #[serde(rename = "assistantId")]
    pub assistant_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub appearances: Vec<Appearance>,
    #[serde(rename = "defaultAppearanceId", skip_serializing_if = "Option::is_none")]
    pub default_appearance_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appearance {
    pub id: String,
    pub name: String,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub actions: HashMap<String, Action>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    #[serde(rename = "type")]
    pub action_type: String,
    pub resources: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fps: Option<u32>,
    pub r#loop: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantsData {
    pub assistants: Vec<Assistant>,
}

fn main() {
    println!("Testing DeepJelly data models...\n");

    // Test 1: Serialize a simple assistant
    let assistant = Assistant {
        id: "work_assistant".to_string(),
        name: "工作助手".to_string(),
        description: Some("我的工作助手".to_string()),
        created_at: Some(1773091032051),
        characters: vec![],
        app_type: None,
        agent_label: None,
        bound_agent_id: None,
        session_key: None,
    };

    let json = serde_json::to_string_pretty(&assistant).unwrap();
    println!("Test 1: Serialize Assistant");
    println!("{}", json);
    println!();

    // Test 2: Deserialize from JSON
    let json_input = r#"{
        "id": "work_assistant",
        "name": "工作助手",
        "description": "我的工作助手",
        "createdAt": 1773091032051,
        "characters": []
    }"#;

    let parsed: Assistant = serde_json::from_str(json_input).unwrap();
    println!("Test 2: Deserialize Assistant");
    println!("ID: {}, Name: {}", parsed.id, parsed.name);
    println!();

    // Test 3: Full three-layer structure
    let mut actions = HashMap::new();
    actions.insert(
        "internal-base-idle".to_string(),
        Action {
            action_type: "frames".to_string(),
            resources: vec!["0001.png".to_string(), "0002.png".to_string()],
            fps: Some(24),
            r#loop: true,
            description: None,
        },
    );

    let appearance = Appearance {
        id: "appr_casual".to_string(),
        name: "休闲装".to_string(),
        is_default: true,
        description: Some("日常休闲装扮".to_string()),
        actions,
    };

    let character = Character {
        id: "char_feishu_private".to_string(),
        assistant_id: "work_assistant".to_string(),
        name: "飞书私聊".to_string(),
        description: Some("飞书私聊渠道".to_string()),
        appearances: vec![appearance],
        default_appearance_id: Some("appr_casual".to_string()),
    };

    let assistant_full = Assistant {
        id: "work_assistant".to_string(),
        name: "工作助手".to_string(),
        description: Some("我的工作助手".to_string()),
        created_at: Some(1773091032051),
        characters: vec![character],
        app_type: None,
        agent_label: None,
        bound_agent_id: None,
        session_key: None,
    };

    let data = AssistantsData {
        assistants: vec![assistant_full],
    };

    let json_full = serde_json::to_string_pretty(&data).unwrap();
    println!("Test 3: Full three-layer structure");
    println!("{}", json_full);
    println!();

    // Test 4: Verify round-trip
    let round_trip: AssistantsData = serde_json::from_str(&json_full).unwrap();
    println!("Test 4: Round-trip verification");
    println!(
        "Success! Parsed {} assistants",
        round_trip.assistants.len()
    );
    println!(
        "First assistant has {} characters",
        round_trip.assistants[0].characters.len()
    );
    println!(
        "First character has {} appearances",
        round_trip.assistants[0].characters[0].appearances.len()
    );
    println!();

    println!("All tests passed!");
}
