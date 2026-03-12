/**
 * Help Settings Component
 *
 * 帮助与使用说明页面
 * @module components/SettingsApp/HelpSettings
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './help.css';

interface HelpSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

export function HelpSettings() {
  const { t } = useTranslation(['help', 'common']);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['initialization']));

  const toggleSection = (id: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSections(newExpanded);
  };

  const sections: HelpSection[] = [
    {
      id: 'initialization',
      title: t('help:initialization.title'),
      content: (
        <div className="help-content">
          <h4>{t('help:initialization.installPlugin.title')}</h4>
          <p>{t('help:initialization.installPlugin.description')}</p>

          <h5>{t('help:initialization.installPlugin.auto.title')}</h5>
          <pre><code>{t('help:initialization.installPlugin.auto.command')}</code></pre>

          <h5>{t('help:initialization.installPlugin.manual.title')}</h5>
          <pre><code>{t('help:initialization.installPlugin.manual.command')}</code></pre>

          <p className="help-note">{t('help:initialization.installPlugin.note')}</p>

          <h4>{t('help:initialization.integrationGuide.title')}</h4>
          <ol>
            <li>{t('help:initialization.integrationGuide.step1')}</li>
            <li>{t('help:initialization.integrationGuide.step2')}</li>
            <li>{t('help:initialization.integrationGuide.step3')}</li>
            <li>{t('help:initialization.integrationGuide.step4')}</li>
            <li>{t('help:initialization.integrationGuide.step5')}</li>
            <li>{t('help:initialization.integrationGuide.step6')}</li>
            <li>{t('help:initialization.integrationGuide.step7')}</li>
            <li>{t('help:initialization.integrationGuide.step8')}</li>
            <li>{t('help:initialization.integrationGuide.step9')}</li>
          </ol>

          <h4>{t('help:initialization.verifyIntegration.title')}</h4>
          <p>{t('help:initialization.verifyIntegration.description')}</p>
        </div>
      ),
    },
    {
      id: 'mainWorkflow',
      title: t('help:mainWorkflow.title'),
      content: (
        <div className="help-content">
          <div className="help-item">
            <h4>{t('help:mainWorkflow.addAssistant.title')}</h4>
            <p>{t('help:mainWorkflow.addAssistant.description')}</p>
            <p className="help-path">{t('help:mainWorkflow.addAssistant.path')}</p>
            <p className="help-note">{t('help:mainWorkflow.addAssistant.note')}</p>
          </div>

          <div className="help-item">
            <h4>{t('help:mainWorkflow.addCharacter.title')}</h4>
            <p>{t('help:mainWorkflow.addCharacter.description')}</p>
            <p className="help-path">{t('help:mainWorkflow.addCharacter.path')}</p>
          </div>

          <div className="help-item">
            <h4>{t('help:mainWorkflow.addAppearance.title')}</h4>
            <p>{t('help:mainWorkflow.addAppearance.description')}</p>
            <p className="help-path">{t('help:mainWorkflow.addAppearance.path')}</p>
            <p className="help-note">{t('help:mainWorkflow.addAppearance.note')}</p>
          </div>

          <div className="help-item">
            <h4>{t('help:mainWorkflow.addAction.title')}</h4>
            <p>{t('help:mainWorkflow.addAction.description')}</p>
            <p className="help-path">{t('help:mainWorkflow.addAction.path')}</p>
            <p className="help-note">{t('help:mainWorkflow.addAction.note')}</p>
          </div>

          <div className="help-item">
            <h4>{t('help:mainWorkflow.appIntegration.title')}</h4>
            <p>{t('help:mainWorkflow.appIntegration.description')}</p>
            <p className="help-path">{t('help:mainWorkflow.appIntegration.path')}</p>
            <p className="help-warning">{t('help:mainWorkflow.appIntegration.warning')}</p>
          </div>

          <div className="help-item">
            <h4>{t('help:mainWorkflow.characterIntegration.title')}</h4>
            <p>{t('help:mainWorkflow.characterIntegration.description')}</p>
            <p className="help-path">{t('help:mainWorkflow.characterIntegration.path')}</p>
            <p className="help-steps">{t('help:mainWorkflow.characterIntegration.steps')}</p>
            <p className="help-warning">{t('help:mainWorkflow.characterIntegration.limit')}</p>
          </div>

          <div className="help-item">
            <h4>{t('help:mainWorkflow.displayManagement.title')}</h4>
            <p>{t('help:mainWorkflow.displayManagement.description')}</p>
            <p className="help-path">{t('help:mainWorkflow.displayManagement.path')}</p>
            <p className="help-note">{t('help:mainWorkflow.displayManagement.note')}</p>
            <p className="help-warning">{t('help:mainWorkflow.displayManagement.limit')}</p>
          </div>

          <div className="help-item">
            <h4>{t('help:mainWorkflow.sendMessage.title')}</h4>
            <p>{t('help:mainWorkflow.sendMessage.way1')}</p>
            <p>{t('help:mainWorkflow.sendMessage.way2')}</p>
            <p>{t('help:mainWorkflow.sendMessage.way3')}</p>
          </div>

          <div className="help-item">
            <h4>{t('help:mainWorkflow.sessionManagement.title')}</h4>
            <p>{t('help:mainWorkflow.sessionManagement.description')}</p>
            <p className="help-path">{t('help:mainWorkflow.sessionManagement.path')}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'basicOperations',
      title: t('help:basicOperations.title'),
      content: (
        <div className="help-content">
          <div className="help-item">
            <h4>{t('help:basicOperations.drag.title')}</h4>
            <p>{t('help:basicOperations.drag.description')}</p>
          </div>

          <div className="help-item">
            <h4>{t('help:basicOperations.penetration.title')}</h4>
            <table className="help-table">
              <thead>
                <tr>
                  <th>{t('help:basicOperations.penetration.table.mode')}</th>
                  <th>{t('help:basicOperations.penetration.table.trigger')}</th>
                  <th>{t('help:basicOperations.penetration.table.effect')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('help:basicOperations.penetration.table.solid')}</td>
                  <td>{t('help:basicOperations.penetration.table.solidTrigger')}</td>
                  <td>{t('help:basicOperations.penetration.table.solidEffect')}</td>
                </tr>
                <tr>
                  <td>{t('help:basicOperations.penetration.table.penetrate')}</td>
                  <td>{t('help:basicOperations.penetration.table.penetrateTrigger')}</td>
                  <td>{t('help:basicOperations.penetration.table.penetrateEffect')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="help-item">
            <h4>{t('help:basicOperations.display.title')}</h4>
            <p>{t('help:basicOperations.display.step1')}</p>
            <p>{t('help:basicOperations.display.step2')}</p>
            <p>{t('help:basicOperations.display.step3')}</p>
          </div>

          <div className="help-item">
            <h4>{t('help:basicOperations.contextMenu.title')}</h4>
            <p>{t('help:basicOperations.contextMenu.entry')}</p>
            <p>{t('help:basicOperations.contextMenu.features')}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'faq',
      title: t('help:faq.title'),
      content: (
        <div className="help-content">
          <div className="help-faq-item">
            <h4>Q: {t('help:faq.q1.question')}</h4>
            <p><strong>A:</strong> {t('help:faq.q1.answer')}</p>
          </div>

          <div className="help-faq-item">
            <h4>Q: {t('help:faq.q2.question')}</h4>
            <p><strong>A:</strong> {t('help:faq.q2.answer')}</p>
          </div>

          <div className="help-faq-item">
            <h4>Q: {t('help:faq.q3.question')}</h4>
            <p><strong>A:</strong> {t('help:faq.q3.answer')}</p>
          </div>

          <div className="help-faq-item">
            <h4>Q: {t('help:faq.q4.question')}</h4>
            <p><strong>A:</strong> {t('help:faq.q4.answer')}</p>
          </div>

          <div className="help-faq-item">
            <h4>Q: {t('help:faq.q5.question')}</h4>
            <p><strong>A:</strong> {t('help:faq.q5.answer')}</p>
          </div>

          <div className="help-faq-item">
            <h4>Q: {t('help:faq.q6.question')}</h4>
            <p><strong>A:</strong> {t('help:faq.q6.answer')}</p>
          </div>

          <div className="help-faq-item">
            <h4>Q: {t('help:faq.q7.question')}</h4>
            <p><strong>A:</strong> {t('help:faq.q7.answer')}</p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="help-settings">
      <h3>{t('help:title')}</h3>

      <div className="help-sections">
        {sections.map((section) => (
          <div key={section.id} className="help-section">
            <button
              className={`help-section-header ${expandedSections.has(section.id) ? 'expanded' : ''}`}
              onClick={() => toggleSection(section.id)}
            >
              <span className="help-section-icon">
                {expandedSections.has(section.id) ? '▼' : '▶'}
              </span>
              <span className="help-section-title">{section.title}</span>
            </button>

            {expandedSections.has(section.id) && (
              <div className="help-section-body">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="help-footer">
        <a
          href="https://github.com/GinSing1226/DeepJelly"
          target="_blank"
          rel="noopener noreferrer"
          className="help-link"
        >
          {t('help:viewOnGitHub')}
        </a>
      </div>
    </div>
  );
}
