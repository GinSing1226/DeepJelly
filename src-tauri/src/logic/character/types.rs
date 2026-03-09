//! Character management data types
//!
//! Defines the data structures for assistants, characters, appearances, and animations.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;


/// 角色
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub assistant_id: String,
}

/// 形象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appearance {
    pub id: String,
    pub name: String,
    pub character_id: String,
    pub is_default: bool,
}

/// 动画域（一级分类）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AnimationDomain {
    Internal,
    Social,
}

/// 动画分类（二级分类）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AnimationCategory {
    Base,
    Work,
    Result,
    Emotion,
    Physics,
    Greeting,
}

/// 动画动作ID（三级分类）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AnimationActionId {
    // Base
    Idle,
    Floating,
    Listen,
    // Work
    Think,
    Execute,
    Speak,
    // Result
    Success,
    Error,
    // Emotion
    Happy,
    Sad,
    Sleepy,
    // Physics
    Walk,
    Drag,
    // Greeting
    Wave,
}

impl AnimationActionId {
    /// 获取动作所属分类
    pub fn category(&self) -> AnimationCategory {
        match self {
            AnimationActionId::Idle | AnimationActionId::Floating | AnimationActionId::Listen => {
                AnimationCategory::Base
            }
            AnimationActionId::Think | AnimationActionId::Execute | AnimationActionId::Speak => {
                AnimationCategory::Work
            }
            AnimationActionId::Success | AnimationActionId::Error => AnimationCategory::Result,
            AnimationActionId::Happy | AnimationActionId::Sad | AnimationActionId::Sleepy => AnimationCategory::Emotion,
            AnimationActionId::Walk | AnimationActionId::Drag => AnimationCategory::Physics,
            AnimationActionId::Wave => AnimationCategory::Greeting,
        }
    }

    /// 获取动作所属域
    pub fn domain(&self) -> AnimationDomain {
        match self.category() {
            AnimationCategory::Base => AnimationDomain::Internal,
            AnimationCategory::Work => AnimationDomain::Internal,
            AnimationCategory::Result => AnimationDomain::Internal,
            AnimationCategory::Emotion => AnimationDomain::Internal,
            AnimationCategory::Physics => AnimationDomain::Internal,
            AnimationCategory::Greeting => AnimationDomain::Social,
        }
    }

    /// 生成动作目录名
    /// 格式: `{domain}-{category}-{action_id}`
    pub fn action_key(&self) -> String {
        let domain_str = match self.domain() {
            AnimationDomain::Internal => "internal",
            AnimationDomain::Social => "social",
        };
        let category_str = match self.category() {
            AnimationCategory::Base => "base",
            AnimationCategory::Work => "work",
            AnimationCategory::Result => "result",
            AnimationCategory::Emotion => "emotion",
            AnimationCategory::Physics => "physics",
            AnimationCategory::Greeting => "greeting",
        };
        let action_str = match self {
            AnimationActionId::Idle => "idle",
            AnimationActionId::Floating => "floating",
            AnimationActionId::Listen => "listen",
            AnimationActionId::Think => "think",
            AnimationActionId::Execute => "execute",
            AnimationActionId::Speak => "speak",
            AnimationActionId::Success => "success",
            AnimationActionId::Error => "error",
            AnimationActionId::Happy => "happy",
            AnimationActionId::Sad => "sad",
            AnimationActionId::Sleepy => "sleepy",
            AnimationActionId::Walk => "walk",
            AnimationActionId::Drag => "drag",
            AnimationActionId::Wave => "wave",
        };
        format!("{}-{}-{}", domain_str, category_str, action_str)
    }
}

/// 动画指令
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationCommand {
    pub domain: AnimationDomain,
    pub category: AnimationCategory,
    pub action_id: AnimationActionId,
    pub urgency: u8,      // 1-10
    pub intensity: f32,    // 0.0-1.0
    pub duration_ms: Option<u64>,
}

impl AnimationCommand {
    /// 创建新的动画指令
    pub fn new(action_id: AnimationActionId) -> Self {
        let domain = action_id.domain();
        let category = action_id.category();

        Self {
            domain,
            category,
            action_id,
            urgency: 5,
            intensity: 1.0,
            duration_ms: None,
        }
    }

    /// 设置优先级
    pub fn with_urgency(mut self, urgency: u8) -> Self {
        self.urgency = urgency.min(10);
        self
    }

    /// 设置强度
    pub fn with_intensity(mut self, intensity: f32) -> Self {
        self.intensity = intensity.clamp(0.0, 1.0);
        self
    }

    /// 设置持续时间
    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    /// 获取动作目录名
    /// 格式: `{domain}-{category}-{action_id}`
    pub fn action_key(&self) -> String {
        self.action_id.action_key()
    }
}

/// 资源类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ResourceType {
    Frames,
    Gif,
    Live2D,
    Model3D,
}

/// 动画资源配置
///
/// 支持两种 JSON 格式：
/// 1. 完整格式: { "type": "frames", "resources": [...], "fps": 12 }
/// 2. 简化格式: { "frames": [...], "frameRate": 12, "loop": true }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationResource {
    #[serde(default = "default_resource_type")]
    pub r#type: ResourceType,
    #[serde(default, alias = "frames")]
    pub resources: Vec<String>,
    #[serde(default, alias = "frameRate")]
    pub fps: Option<u32>,
    #[serde(default = "default_loop", alias = "loop")]
    pub r#loop: Option<bool>,
    #[serde(default)]
    pub description: Option<String>,
}

fn default_resource_type() -> ResourceType {
    ResourceType::Frames
}

fn default_loop() -> Option<bool> {
    Some(true)
}

impl AnimationResource {
    /// 创建帧序列资源
    pub fn frames(resources: Vec<String>, fps: u32) -> Self {
        Self {
            r#type: ResourceType::Frames,
            resources,
            fps: Some(fps),
            r#loop: Some(true),
            description: None,
        }
    }

    /// 创建 GIF 资源
    pub fn gif(resource: String) -> Self {
        Self {
            r#type: ResourceType::Gif,
            resources: vec![resource],
            fps: None,
            r#loop: Some(true),
            description: None,
        }
    }
}

/// 角色配置文件
///
/// 支持两种 JSON 格式：
/// 1. 完整格式: { "character_id": "xxx", "name": "...", "assistant_id": "xxx", "appearances": [...] }
/// 2. 简化格式: { "id": "xxx", "name": "...", "appearances": [...] }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterConfig {
    #[serde(rename = "id")]
    pub character_id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub assistant_id: Option<String>,
    pub appearances: Vec<AppearanceConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(alias = "isDefault")]
    pub is_default: bool,
    pub actions: HashMap<String, AnimationResource>,
}

/// 角色来源信息
/// 用于追踪角色资源的存储位置
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct CharacterSource {
    /// 角色所在的基础目录
    pub base_dir: std::path::PathBuf,
    /// 是否为用户自定义角色
    pub is_user_defined: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_animation_command_creation() {
        let cmd = AnimationCommand::new(AnimationActionId::Idle);
        assert_eq!(cmd.action_id, AnimationActionId::Idle);
        assert_eq!(cmd.domain, AnimationDomain::Internal);
        assert_eq!(cmd.category, AnimationCategory::Base);
        assert_eq!(cmd.urgency, 5);
        assert_eq!(cmd.intensity, 1.0);
    }

    #[test]
    fn test_animation_command_builder() {
        let cmd = AnimationCommand::new(AnimationActionId::Think)
            .with_urgency(8)
            .with_intensity(0.7)
            .with_duration(2000);

        assert_eq!(cmd.urgency, 8);
        assert_eq!(cmd.intensity, 0.7);
        assert_eq!(cmd.duration_ms, Some(2000));
    }

    #[test]
    fn test_urgency_clamp() {
        let cmd = AnimationCommand::new(AnimationActionId::Idle).with_urgency(15);
        assert_eq!(cmd.urgency, 10); // Clamped to 10
    }

    #[test]
    fn test_intensity_clamp() {
        let cmd = AnimationCommand::new(AnimationActionId::Idle).with_intensity(1.5);
        assert_eq!(cmd.intensity, 1.0); // Clamped to 1.0

        let cmd = AnimationCommand::new(AnimationActionId::Idle).with_intensity(-0.5);
        assert_eq!(cmd.intensity, 0.0); // Clamped to 0.0
    }

    #[test]
    fn test_frames_resource() {
        let resources = vec!["frame1.png".to_string(), "frame2.png".to_string()];
        let res = AnimationResource::frames(resources, 12);
        assert_eq!(res.r#type, ResourceType::Frames);
        assert_eq!(res.fps, Some(12));
    }

    #[test]
    fn test_gif_resource() {
        let res = AnimationResource::gif("animation.gif".to_string());
        assert_eq!(res.r#type, ResourceType::Gif);
        assert_eq!(res.resources.len(), 1);
    }

    #[test]
    fn test_animation_action_id_domains() {
        assert_eq!(AnimationActionId::Idle.domain(), AnimationDomain::Internal);
        assert_eq!(AnimationActionId::Think.category(), AnimationCategory::Work);
    }
}
