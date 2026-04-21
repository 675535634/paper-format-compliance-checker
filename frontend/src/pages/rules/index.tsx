import { useEffect, useState } from 'react';
import { Form, Input, Select, Button, Card, Row, Col, Divider, message, Skeleton } from 'antd';
import { api } from '../../api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PaperRuleConfig, RuleTemplate } from '../../types';

const { Option } = Select;

const defaultRules: PaperRuleConfig = {
  pageSize: 'A4',
  margin: '上 2.5cm, 下 2.5cm, 左 3cm, 右 2.5cm',
  bodyFont: '宋体',
  bodyFontSize: '小四',
  lineHeight: '1.5',
  paragraphSpacing: '段前0行, 段后0行',
  firstLineIndent: '2字符',
  headingFormats: '一级标题 黑体三号; 二级标题 黑体四号',
  pageNumberRule: '底部居中，阿拉伯数字',
  abstractFormat: '黑体小四，行距1.5',
  keywordFormat: '黑体小四',
  referenceFormat: 'GB/T 7714-2015'
};

const RulesConfig: React.FC = () => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<RuleTemplate | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId');

  useEffect(() => {
    if (!templateId) {
      setCurrentTemplate(null);
      form.setFieldsValue({
        ...defaultRules,
        templateName: '自定义格式模板',
        description: ''
      });
      return;
    }

    const loadTemplate = async () => {
      setLoading(true);
      try {
        const template = await api.getTemplate(templateId);
        setCurrentTemplate(template);
        form.setFieldsValue({
          templateName: template.name,
          description: template.description,
          ...template.config,
        });
      } catch (error) {
        message.error('加载模板失败');
      } finally {
        setLoading(false);
      }
    };

    void loadTemplate();
  }, [form, templateId]);

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const { templateName, description, ...config } = values;
      await api.saveTemplate({
        id: currentTemplate?.id,
        name: templateName,
        description,
        config: config as PaperRuleConfig,
        isDefault: currentTemplate?.isDefault ?? false
      });
      message.success(currentTemplate ? '模板更新成功' : '保存模板成功');
      navigate('/templates');
    } catch (e) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Card bordered={false} title={<span style={{ fontSize: 20 }}>{currentTemplate ? '编辑格式模板' : '格式要求配置'}</span>}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            ...defaultRules,
            templateName: '自定义格式模板',
            description: ''
          }}
          onFinish={handleSave}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="templateName" label="模板名称" rules={[{ required: true }]}>
                <Input placeholder="输入模板名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="description" label="模板说明">
                <Input placeholder="输入模板说明" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>页面与排版</Divider>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="pageSize" label="页面大小">
                <Select>
                  <Option value="A4">A4 (210×297mm)</Option>
                  <Option value="B5">B5 (176×250mm)</Option>
                  <Option value="A3">A3 (297×420mm)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="margin" label="页边距">
                <Input placeholder="例: 上 2.5cm, 下 2.5cm, 左 3cm, 右 2.5cm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pageNumberRule" label="页码规则">
                <Input placeholder="例: 底部居中，阿拉伯数字" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>正文格式</Divider>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="bodyFont" label="正文字体">
                <Select>
                  <Option value="宋体">宋体</Option>
                  <Option value="黑体">黑体</Option>
                  <Option value="楷体">楷体</Option>
                  <Option value="仿宋">仿宋</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bodyFontSize" label="正文字号">
                <Select>
                  <Option value="三号">三号</Option>
                  <Option value="小三">小三</Option>
                  <Option value="四号">四号</Option>
                  <Option value="小四">小四</Option>
                  <Option value="五号">五号</Option>
                  <Option value="小五">小五</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="lineHeight" label="行距">
                <Input placeholder="例: 1.5倍 或 20磅" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="paragraphSpacing" label="段前段后">
                <Input placeholder="例: 段前0.5行, 段后0.5行" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="firstLineIndent" label="首行缩进">
                <Input placeholder="例: 2字符" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>特定区块格式</Divider>
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item name="headingFormats" label="标题层级格式">
                <Input.TextArea rows={2} placeholder="例: 一级标题 黑体三号; 二级标题 黑体四号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="abstractFormat" label="摘要格式">
                <Input placeholder="例: 黑体小四，行距1.5" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="keywordFormat" label="关键词格式">
                <Input placeholder="例: 黑体小四，词间分号隔开" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="referenceFormat" label="参考文献格式">
                <Select>
                  <Option value="GB/T 7714-2015">GB/T 7714-2015 (国家标准)</Option>
                  <Option value="APA">APA格式</Option>
                  <Option value="MLA">MLA格式</Option>
                  <Option value="IEEE">IEEE格式</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button type="primary" htmlType="submit" size="large" loading={saving} style={{ width: 160 }}>
              {currentTemplate ? '保存修改' : '保存为模板'}
            </Button>
            <Button
              size="large"
              style={{ marginLeft: 16 }}
              onClick={() => {
                if (currentTemplate) {
                  form.setFieldsValue({
                    templateName: currentTemplate.name,
                    description: currentTemplate.description,
                    ...currentTemplate.config,
                  });
                  return;
                }

                form.resetFields();
              }}
            >
              {currentTemplate ? '恢复原值' : '重置'}
            </Button>
          </div>
        </Form>
        )}
      </Card>
    </div>
  );
};

export default RulesConfig;
