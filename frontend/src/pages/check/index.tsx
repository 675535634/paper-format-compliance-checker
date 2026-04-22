import { useEffect, useState } from 'react';
import { Upload, Select, Button, Typography, Card, Space, message, Spin, Alert } from 'antd';
import { InboxOutlined, FileWordOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { api } from '../../api';
import type { RuleTemplate } from '../../types';
import { useAppStore } from '../../store';
import { useNavigate, useSearchParams } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const CheckPaper: React.FC = () => {
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [checking, setChecking] = useState(false);

  const currentPaper = useAppStore((state) => state.currentPaper);
  const setCurrentPaper = useAppStore((state) => state.setCurrentPaper);
  const setCurrentResult = useAppStore((state) => state.setCurrentResult);

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
        message.error('获取模板失败');
      }
    };

    void fetchTemplates();
  }, [templateIdFromUrl]);

  const props: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.docx',
    beforeUpload: (file) => {
      const isDocx = file.name.toLowerCase().endsWith('.docx');
      if (!isDocx) {
        message.error(`${file.name} 不是 .docx 文件，请上传 Word 文档。`);
        return Upload.LIST_IGNORE;
      }

      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const uploaded = await api.uploadPaper(file as File);
        setCurrentPaper(uploaded);
        onSuccess?.('ok');
        message.success(`${uploaded.filename} 上传成功`);
      } catch (error) {
        onError?.(error as Error);
        message.error('文件上传失败');
      }
    },
    showUploadList: false,
  };

  const handleStartCheck = async () => {
    if (!currentPaper) {
      message.warning('请先上传论文');
      return;
    }

    if (!selectedTemplate) {
      message.warning('请选择检测模板');
      return;
    }

    setChecking(true);
    try {
      const result = await api.checkPaperFormat(currentPaper.id, selectedTemplate);
      setCurrentResult(result);
      message.success('检测完成');
      navigate(`/result/${result.id}`);
    } catch {
      message.error('检测失败，请稍后重试');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        论文格式检测
      </Title>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        title="当前仅支持 .docx 格式"
        description="建议上传按学校模板排版后的 Word 文档，系统会根据所选模板给出位置化问题提示。"
      />

      <Card variant="borderless" style={{ marginBottom: 24 }}>
        <Title level={5}>1. 上传论文</Title>
        <Paragraph type="secondary">支持上传 `.docx` 格式的 Word 文档。</Paragraph>

        {!currentPaper ? (
          <Dragger {...props}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或将文件拖到这里上传</p>
            <p className="ant-upload-hint">单个文件不超过 50MB</p>
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
              <Button type="link" onClick={() => setCurrentPaper(null)}>
                重新上传
              </Button>
            </div>
          </Card>
        )}
      </Card>

      <Card variant="borderless" style={{ marginBottom: 24 }}>
        <Title level={5}>2. 选择模板</Title>
        <Paragraph type="secondary">选择要对照的格式模板，默认会优先使用当前默认模板。</Paragraph>

        <Select
          style={{ width: '100%', maxWidth: 480 }}
          placeholder="请选择检测模板"
          value={selectedTemplate || undefined}
          onChange={setSelectedTemplate}
          options={templates.map((template) => ({ value: template.id, label: template.name }))}
        />
      </Card>

      <div style={{ textAlign: 'center', marginTop: 40 }}>
        {checking ? (
          <Spin tip="正在进行格式检测，请稍候..." size="large">
            <div style={{ padding: 50 }} />
          </Spin>
        ) : (
          <Button
            type="primary"
            size="large"
            onClick={handleStartCheck}
            disabled={!currentPaper || !selectedTemplate}
            style={{ width: 220, height: 48, fontSize: 16 }}
          >
            开始检测
          </Button>
        )}
      </div>
    </div>
  );
};

export default CheckPaper;
