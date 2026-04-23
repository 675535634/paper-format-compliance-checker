import { useEffect, useMemo, useState } from 'react';
import { Upload, Select, Button, Typography, Card, Space, message, Spin, Alert } from 'antd';
import { InboxOutlined, FileWordOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { api } from '../../api';
import type { RuleTemplate } from '../../types';
import { useAppStore } from '../../store';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../i18n';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const CheckPaper: React.FC = () => {
  const { isEnglish } = useI18n();
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [checking, setChecking] = useState(false);

  const currentPaper = useAppStore((state) => state.currentPaper);
  const currentResult = useAppStore((state) => state.currentResult);
  const setCurrentPaper = useAppStore((state) => state.setCurrentPaper);
  const setCurrentResult = useAppStore((state) => state.setCurrentResult);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const restoredPaperNoticeVisible = useAppStore((state) => state.restoredPaperNoticeVisible);
  const restoredResultNoticeVisible = useAppStore((state) => state.restoredResultNoticeVisible);
  const dismissRestoredPaperNotice = useAppStore((state) => state.dismissRestoredPaperNotice);
  const dismissRestoredResultNotice = useAppStore((state) => state.dismissRestoredResultNotice);
  const clearCurrentContext = useAppStore((state) => state.clearCurrentContext);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateIdFromUrl = searchParams.get('templateId');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await api.getTemplates();
        setTemplates(data);
        const preferredTemplate = templateIdFromUrl
          ? data.find((template) => template.id === templateIdFromUrl)
          : data.find((template) => template.isDefault);

        if (preferredTemplate) {
          setSelectedTemplate(preferredTemplate.id);
        } else if (data.length > 0) {
          setSelectedTemplate(data[0].id);
        }
      } catch {
        message.error(isEnglish ? 'Failed to load templates.' : '获取模板失败');
      }
    };

    void fetchTemplates();
  }, [templateIdFromUrl]);

  const restoredNoticeDescription = useMemo(() => {
    if (!hasHydrated) {
      return '';
    }

    if (restoredPaperNoticeVisible && restoredResultNoticeVisible && currentPaper && currentResult) {
      return isEnglish
        ? `Restored the latest uploaded paper "${currentPaper.filename}" together with its check result. You can continue checking or jump straight back to the latest result page.`
        : `已恢复最近上传的论文“${currentPaper.filename}”以及对应检测结果。你可以继续检测，或直接回到最近结果页。`;
    }

    if (restoredPaperNoticeVisible && currentPaper) {
      return isEnglish
        ? `Restored the latest uploaded paper "${currentPaper.filename}". You can continue with it or clear the local context and upload again.`
        : `已恢复最近上传的论文“${currentPaper.filename}”。你可以继续使用它检测，也可以清除后重新上传。`;
    }

    if (restoredResultNoticeVisible && currentResult) {
      return isEnglish
        ? 'Restored the latest check result context. You can open the result directly or clear the local record and start again.'
        : '已恢复最近一次检测结果上下文。你可以直接查看结果，也可以清除本地记录后重新开始。';
    }

    return '';
  }, [
    currentPaper,
    currentResult,
    hasHydrated,
    isEnglish,
    restoredPaperNoticeVisible,
    restoredResultNoticeVisible,
  ]);

  const shouldShowRestoredNotice = hasHydrated
    && (restoredPaperNoticeVisible || restoredResultNoticeVisible)
    && (Boolean(currentPaper) || Boolean(currentResult));

  const props: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.docx',
    beforeUpload: (file) => {
      const isDocx = file.name.toLowerCase().endsWith('.docx');
      if (!isDocx) {
        message.error(isEnglish ? `${file.name} is not a .docx file. Please upload a Word document.` : `${file.name} 不是 .docx 文件，请上传 Word 文档。`);
        return Upload.LIST_IGNORE;
      }

      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const uploaded = await api.uploadPaper(file as File);
        setCurrentPaper(uploaded);
        onSuccess?.('ok');
        message.success(isEnglish ? `${uploaded.filename} uploaded successfully.` : `${uploaded.filename} 上传成功`);
      } catch (error) {
        onError?.(error as Error);
        message.error(isEnglish ? 'Upload failed.' : '文件上传失败');
      }
    },
    showUploadList: false,
  };

  const handleStartCheck = async () => {
    if (!currentPaper) {
      message.warning(isEnglish ? 'Upload a paper first.' : '请先上传论文');
      return;
    }

    if (!selectedTemplate) {
      message.warning(isEnglish ? 'Select a template first.' : '请选择检测模板');
      return;
    }

    setChecking(true);
    try {
      const result = await api.checkPaperFormat(currentPaper.id, selectedTemplate);
      setCurrentResult(result);
      message.success(isEnglish ? 'Check completed.' : '检测完成');
      navigate(`/result/${result.id}`);
    } catch {
      message.error(isEnglish ? 'Check failed. Please try again later.' : '检测失败，请稍后重试');
    } finally {
      setChecking(false);
    }
  };

  const handleCloseRestoredNotice = () => {
    dismissRestoredPaperNotice();
    dismissRestoredResultNotice();
  };

  return (
    <div data-testid="page-check" style={{ maxWidth: 860, margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        {isEnglish ? 'Paper Format Check' : '论文格式检测'}
      </Title>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        title={isEnglish ? 'Only .docx files are supported' : '当前仅支持 .docx 格式'}
        description={isEnglish
          ? 'Upload a Word document that follows the school template. The system will report issues with clear locations based on the selected rule set.'
          : '建议上传按学校模板排版后的 Word 文档，系统会根据所选模板给出位置化问题提示。'}
      />

      {shouldShowRestoredNotice && (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={handleCloseRestoredNotice}
          style={{ marginBottom: 24 }}
          title={isEnglish ? 'Restored the latest local working context' : '已从本地恢复最近一次工作上下文'}
          description={restoredNoticeDescription}
          action={(
            <Space>
              {currentResult && (
                <Button size="small" type="link" onClick={() => navigate(`/result/${currentResult.id}`)}>
                  {isEnglish ? 'Open Last Result' : '查看最近结果'}
                </Button>
              )}
              <Button size="small" onClick={clearCurrentContext}>
                {isEnglish ? 'Clear Local Context' : '清除本地记录'}
              </Button>
            </Space>
          )}
        />
      )}

      <Card variant="borderless" style={{ marginBottom: 24 }}>
        <Title level={5}>{isEnglish ? '1. Upload Paper' : '1. 上传论文'}</Title>
        <Paragraph type="secondary">{isEnglish ? 'Upload a `.docx` Word document.' : '支持上传 `.docx` 格式的 Word 文档。'}</Paragraph>

        {!currentPaper ? (
          <Dragger {...props}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{isEnglish ? 'Click or drag a file here to upload' : '点击或将文件拖到这里上传'}</p>
            <p className="ant-upload-hint">{isEnglish ? 'One file only, up to 50 MB' : '单个文件不超过 50MB'}</p>
          </Dragger>
        ) : (
          <Card type="inner" style={{ background: '#f5f5f5', border: '1px dashed #d9d9d9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Space>
                <FileWordOutlined style={{ fontSize: 24, color: '#1677ff' }} />
                <div>
                  <Text strong>{currentPaper.filename}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {(currentPaper.size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                </div>
              </Space>
              <Button type="link" onClick={clearCurrentContext}>
                {isEnglish ? 'Upload Another File' : '重新上传'}
              </Button>
            </div>
          </Card>
        )}
      </Card>

      <Card variant="borderless" style={{ marginBottom: 24 }}>
        <Title level={5}>{isEnglish ? '2. Select Template' : '2. 选择模板'}</Title>
        <Paragraph type="secondary">{isEnglish ? 'Choose the rule template to compare against. The current default template is preferred automatically.' : '选择要对照的格式模板，默认会优先使用当前默认模板。'}</Paragraph>

        <Select
          data-testid="template-select"
          style={{ width: '100%', maxWidth: 480 }}
          placeholder={isEnglish ? 'Select a check template' : '请选择检测模板'}
          value={selectedTemplate || undefined}
          onChange={setSelectedTemplate}
          options={templates.map((template) => ({ value: template.id, label: template.name }))}
        />
      </Card>

      <div style={{ textAlign: 'center', marginTop: 40 }}>
        {checking ? (
          <Spin tip={isEnglish ? 'Checking the document format. Please wait...' : '正在进行格式检测，请稍候...'} size="large">
            <div style={{ padding: 50 }} />
          </Spin>
        ) : (
          <Button
            data-testid="start-check-button"
            type="primary"
            size="large"
            onClick={handleStartCheck}
            disabled={!currentPaper || !selectedTemplate}
            style={{ width: 220, height: 48, fontSize: 16 }}
          >
            {isEnglish ? 'Start Check' : '开始检测'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CheckPaper;
